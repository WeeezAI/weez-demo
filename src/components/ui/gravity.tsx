"use client";

import {
  createContext,
  forwardRef,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { debounce } from "lodash";
import Matter, {
  Bodies,
  Common,
  Engine,
  Events,
  Mouse,
  MouseConstraint,
  Query,
  Render,
  Runner,
  World,
} from "matter-js";
import decomp from "poly-decomp";

import { cn } from "@/lib/utils";

// Helper function to calculate position
const calculatePosition = (
  value: number | string | undefined,
  containerSize: number,
  elementSize: number
): number => {
  if (value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.endsWith("%")) {
    const percentage = parseFloat(value) / 100;
    return containerSize * percentage;
  }
  return parseFloat(value) || 0;
};

type GravityProps = {
  children: ReactNode;
  debug?: boolean;
  gravity?: { x: number; y: number };
  resetOnResize?: boolean;
  grabCursor?: boolean;
  addTopWall?: boolean;
  autoStart?: boolean;
  className?: string;
};

type PhysicsBody = {
  element: HTMLElement;
  body: Matter.Body;
  props: MatterBodyProps;
};

type MatterBodyProps = {
  children: ReactNode;
  matterBodyOptions?: Matter.IBodyDefinition;
  isDraggable?: boolean;
  bodyType?: "rectangle" | "circle";
  x?: number | string;
  y?: number | string;
  angle?: number;
  className?: string;
};

export type GravityRef = {
  start: () => void;
  stop: () => void;
  reset: () => void;
};

const GravityContext = createContext<{
  registerElement: (
    id: string,
    element: HTMLElement,
    props: MatterBodyProps
  ) => void;
  unregisterElement: (id: string) => void;
} | null>(null);

export const MatterBody = ({
  children,
  className,
  matterBodyOptions = {
    friction: 0.1,
    restitution: 0.1,
    density: 0.001,
    isStatic: false,
  },
  bodyType = "rectangle",
  isDraggable = true,
  x = 0,
  y = 0,
  angle = 0,
  ...props
}: MatterBodyProps) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(Math.random().toString(36).substring(7));
  const context = useContext(GravityContext);
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!elementRef.current || !context || registeredRef.current) return;
    
    registeredRef.current = true;
    context.registerElement(idRef.current, elementRef.current, {
      children,
      matterBodyOptions,
      bodyType,
      isDraggable,
      x,
      y,
      angle,
      ...props,
    });

    return () => {
      context.unregisterElement(idRef.current);
      registeredRef.current = false;
    };
  }, [context]);

  return (
    <div
      ref={elementRef}
      className={cn(
        "absolute",
        className,
        isDraggable && "pointer-events-none"
      )}
    >
      {children}
    </div>
  );
};

const Gravity = forwardRef<GravityRef, GravityProps>(
  (
    {
      children,
      debug = false,
      gravity = { x: 0, y: 1 },
      grabCursor = true,
      resetOnResize = true,
      addTopWall = true,
      autoStart = false,
      className,
      ...props
    },
    ref
  ) => {
    const canvas = useRef<HTMLDivElement>(null);
    const engine = useRef(Engine.create());
    const render = useRef<Render | undefined>(undefined);
    const runner = useRef<Runner | undefined>(undefined);
    const bodiesMap = useRef(new Map<string, PhysicsBody>());
    const frameId = useRef<number | undefined>(undefined);
    const mouseConstraint = useRef<Matter.MouseConstraint | undefined>(undefined);
    const mouseDown = useRef(false);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const hasSettled = useRef(false);
    const settlementCheckInterval = useRef<number | undefined>(undefined);
    const initializedRef = useRef(false);

    const isRunning = useRef(false);

    // Register Matter.js body in the physics world
    const registerElement = useCallback(
      (id: string, element: HTMLElement, props: MatterBodyProps) => {
        if (!canvas.current || bodiesMap.current.has(id)) return;
        
        const width = element.offsetWidth;
        const height = element.offsetHeight;
        const canvasRect = canvas.current!.getBoundingClientRect();

        const angleRad = ((props.angle || 0) * Math.PI) / 180;

        const x = calculatePosition(props.x, canvasRect.width, width);
        const y = calculatePosition(props.y, canvasRect.height, height);

        let body;
        if (props.bodyType === "circle") {
          const radius = Math.max(width, height) / 2;
          body = Bodies.circle(x, y, radius, {
            ...props.matterBodyOptions,
            isStatic: true, // Start as static (at rest)
            angle: angleRad,
            render: {
              fillStyle: debug ? "#888888" : "#00000000",
              strokeStyle: debug ? "#333333" : "#00000000",
              lineWidth: debug ? 3 : 0,
            },
          });
        } else {
          body = Bodies.rectangle(x, y, width, height, {
            ...props.matterBodyOptions,
            isStatic: true, // Start as static (at rest)
            angle: angleRad,
            render: {
              fillStyle: debug ? "#888888" : "#00000000",
              strokeStyle: debug ? "#333333" : "#00000000",
              lineWidth: debug ? 3 : 0,
            },
          });
        }

        if (body) {
          World.add(engine.current.world, [body]);
          bodiesMap.current.set(id, { element, body, props });
        }
      },
      [debug]
    );

    // Unregister Matter.js body from the physics world
    const unregisterElement = useCallback((id: string) => {
      const body = bodiesMap.current.get(id);
      if (body) {
        World.remove(engine.current.world, body.body);
        bodiesMap.current.delete(id);
      }
    }, []);

    // Check if all bodies have settled (stopped moving)
    const checkSettlement = useCallback(() => {
      if (bodiesMap.current.size === 0) return;
      
      let allSettled = true;
      bodiesMap.current.forEach(({ body }) => {
        if (body.isStatic) return; // Skip static bodies
        
        const velocity = body.velocity;
        const angularVelocity = body.angularVelocity;
        
        // Check if body is moving (velocity threshold)
        if (Math.abs(velocity.x) > 0.1 || Math.abs(velocity.y) > 0.1 || Math.abs(angularVelocity) > 0.01) {
          allSettled = false;
        }
      });

      if (allSettled && !hasSettled.current) {
        hasSettled.current = true;
        stopEngine();
        if (settlementCheckInterval.current) {
          clearInterval(settlementCheckInterval.current);
          settlementCheckInterval.current = undefined;
        }
      }
    }, []);

    // Keep react elements in sync with the physics world
    const updateElements = useCallback(() => {
      bodiesMap.current.forEach(({ element, body }) => {
        const { x, y } = body.position;
        const rotation = (body.angle * 180) / Math.PI;

        element.style.transform = `translate(${
          x - element.offsetWidth / 2
        }px, ${y - element.offsetHeight / 2}px) rotate(${rotation}deg)`;
      });

      if (isRunning.current) {
        frameId.current = requestAnimationFrame(updateElements);
      }
    }, []);

    const initializeRenderer = useCallback(() => {
      if (!canvas.current || initializedRef.current) return;

      initializedRef.current = true;
      const height = canvas.current.offsetHeight;
      const width = canvas.current.offsetWidth;

      Common.setDecomp(decomp);

      engine.current.gravity.x = gravity.x;
      engine.current.gravity.y = gravity.y;

      render.current = Render.create({
        element: canvas.current,
        engine: engine.current,
        options: {
          width,
          height,
          wireframes: false,
          background: "#00000000",
        },
      });

      const mouse = Mouse.create(render.current.canvas);
      mouseConstraint.current = MouseConstraint.create(engine.current, {
        mouse: mouse,
        constraint: {
          stiffness: 0.2,
          render: {
            visible: debug,
          },
        },
      });

      // When user starts dragging, make body dynamic and start physics
      Events.on(mouseConstraint.current, 'startdrag', (event) => {
        const draggedBody = event.body;
        
        // Make all bodies dynamic when user interacts
        bodiesMap.current.forEach(({ body }) => {
          Matter.Body.setStatic(body, false);
        });
        
        hasSettled.current = false;
        if (!isRunning.current) {
          startEngine();
        }
        
        // Start checking for settlement
        if (!settlementCheckInterval.current) {
          settlementCheckInterval.current = window.setInterval(checkSettlement, 200);
        }
      });

      // Add walls with proper boundaries
      const wallThickness = 50;
      const walls = [
        // Floor
        Bodies.rectangle(width / 2, height + wallThickness / 2, width + wallThickness * 2, wallThickness, {
          isStatic: true,
          friction: 1,
          render: {
            visible: debug,
          },
        }),

        // Right wall
        Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height + wallThickness * 2, {
          isStatic: true,
          friction: 1,
          render: {
            visible: debug,
          },
        }),

        // Left wall
        Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height + wallThickness * 2, {
          isStatic: true,
          friction: 1,
          render: {
            visible: debug,
          },
        }),
      ];

      // Top wall
      const topWall = Bodies.rectangle(width / 2, -wallThickness / 2, width + wallThickness * 2, wallThickness, {
        isStatic: true,
        friction: 1,
        render: {
          visible: debug,
        },
      });

      if (addTopWall) {
        walls.push(topWall);
      }

      const touchingMouse = () =>
        Query.point(
          engine.current.world.bodies,
          mouseConstraint.current?.mouse.position || { x: 0, y: 0 }
        ).length > 0;

      if (grabCursor) {
        Events.on(engine.current, "beforeUpdate", () => {
          if (canvas.current) {
            if (!mouseDown.current && !touchingMouse()) {
              canvas.current.style.cursor = "default";
            } else if (touchingMouse()) {
              canvas.current.style.cursor = mouseDown.current
                ? "grabbing"
                : "grab";
            }
          }
        });

        canvas.current.addEventListener("mousedown", () => {
          mouseDown.current = true;

          if (canvas.current) {
            if (touchingMouse()) {
              canvas.current.style.cursor = "grabbing";
            } else {
              canvas.current.style.cursor = "default";
            }
          }
        });
        canvas.current.addEventListener("mouseup", () => {
          mouseDown.current = false;

          if (canvas.current) {
            if (touchingMouse()) {
              canvas.current.style.cursor = "grab";
            } else {
              canvas.current.style.cursor = "default";
            }
          }
        });
      }

      World.add(engine.current.world, [mouseConstraint.current, ...walls]);

      render.current.mouse = mouse;

      runner.current = Runner.create();
      Render.run(render.current);
      runner.current.enabled = false;

      // Always keep rendering for visual updates
      updateElements();

      if (autoStart) {
        runner.current.enabled = true;
        startEngine();
        setTimeout(() => {
          settlementCheckInterval.current = window.setInterval(checkSettlement, 200);
        }, 500);
      }
    }, [debug, autoStart, gravity, addTopWall, grabCursor, checkSettlement, updateElements]);

    // Clear the Matter.js world
    const clearRenderer = useCallback(() => {
      if (frameId.current) {
        cancelAnimationFrame(frameId.current);
      }

      if (settlementCheckInterval.current) {
        clearInterval(settlementCheckInterval.current);
        settlementCheckInterval.current = undefined;
      }

      if (mouseConstraint.current) {
        World.remove(engine.current.world, mouseConstraint.current);
      }

      if (render.current) {
        Mouse.clearSourceEvents(render.current.mouse);
        Render.stop(render.current);
        render.current.canvas.remove();
      }

      if (runner.current) {
        Runner.stop(runner.current);
      }

      if (engine.current) {
        World.clear(engine.current.world, false);
        Engine.clear(engine.current);
      }

      bodiesMap.current.clear();
      hasSettled.current = false;
      initializedRef.current = false;
    }, []);

    const handleResize = useCallback(() => {
      if (!canvas.current || !resetOnResize) return;

      const newWidth = canvas.current.offsetWidth;
      const newHeight = canvas.current.offsetHeight;

      setCanvasSize({ width: newWidth, height: newHeight });

      // Clear and reinitialize
      clearRenderer();
      initializeRenderer();
    }, [clearRenderer, initializeRenderer, resetOnResize]);

    const startEngine = useCallback(() => {
      if (isRunning.current) return;
      
      if (runner.current) {
        runner.current.enabled = true;
        Runner.run(runner.current, engine.current);
      }
      if (render.current) {
        Render.run(render.current);
      }
      isRunning.current = true;
      if (!frameId.current) {
        frameId.current = requestAnimationFrame(updateElements);
      }
    }, [updateElements]);

    const stopEngine = useCallback(() => {
      if (!isRunning.current) return;

      if (runner.current) {
        Runner.stop(runner.current);
      }
      if (render.current) {
        Render.stop(render.current);
      }
      if (frameId.current) {
        cancelAnimationFrame(frameId.current);
        frameId.current = undefined;
      }
      isRunning.current = false;
    }, []);

    const reset = useCallback(() => {
      stopEngine();
      hasSettled.current = false;
      bodiesMap.current.forEach(({ element, body, props }) => {
        body.angle = props.angle || 0;

        const x = calculatePosition(
          props.x,
          canvasSize.width,
          element.offsetWidth
        );
        const y = calculatePosition(
          props.y,
          canvasSize.height,
          element.offsetHeight
        );
        body.position.x = x;
        body.position.y = y;
        
        // Reset velocities and make static again
        Matter.Body.setVelocity(body, { x: 0, y: 0 });
        Matter.Body.setAngularVelocity(body, 0);
        Matter.Body.setStatic(body, true);
      });
      updateElements();
      handleResize();
    }, [stopEngine, canvasSize, updateElements, handleResize]);

    useImperativeHandle(
      ref,
      () => ({
        start: startEngine,
        stop: stopEngine,
        reset,
      }),
      [startEngine, stopEngine, reset]
    );

    useEffect(() => {
      if (!resetOnResize) return;

      const debouncedResize = debounce(handleResize, 500);
      window.addEventListener("resize", debouncedResize);

      return () => {
        window.removeEventListener("resize", debouncedResize);
        debouncedResize.cancel();
      };
    }, [handleResize, resetOnResize]);

    useEffect(() => {
      initializeRenderer();
      return () => {
        clearRenderer();
      };
    }, [initializeRenderer, clearRenderer]);

    return (
      <GravityContext.Provider value={{ registerElement, unregisterElement }}>
        <div
          ref={canvas}
          className={cn(className, "absolute top-0 left-0 w-full h-full")}
          {...props}
        >
          {children}
        </div>
      </GravityContext.Provider>
    );
  }
);

Gravity.displayName = "Gravity";
export { Gravity };
