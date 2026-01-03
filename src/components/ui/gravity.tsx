"use client";

import {
  createContext,
  forwardRef,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { debounce } from "lodash";
import Matter, {
  Bodies,
  Common,
  Constraint,
  Engine,
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

// Haptic feedback helper
const triggerHaptic = (type: 'grab' | 'release') => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(type === 'grab' ? 15 : 8);
  }
};

type GravityProps = {
  children: ReactNode;
  debug?: boolean;
  gravity?: { x: number; y: number };
  resetOnResize?: boolean;
  grabCursor?: boolean;
  addTopWall?: boolean;
  autoStart?: boolean;
  enableHaptics?: boolean;
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
        "absolute z-10 select-none touch-none",
        // Larger hit area with padding for mobile
        "p-2 -m-2",
        isDraggable && "cursor-grab active:cursor-grabbing",
        className
      )}
      style={{ 
        // Ensure touch targets are at least 44x44px for accessibility
        minWidth: '44px',
        minHeight: '44px',
      }}
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
      enableHaptics = true,
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

    const pointerHandlersRef = useRef<{
      down: (e: PointerEvent) => void;
      move: (e: PointerEvent) => void;
      up: (e: PointerEvent) => void;
      cancel: (e: PointerEvent) => void;
    } | null>(null);

    const activeDragRef = useRef<{
      pointerId: number;
      constraint: Matter.Constraint;
      body: Matter.Body;
    } | null>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const hasSettled = useRef(false);
    const settlementCheckInterval = useRef<number | undefined>(undefined);
    const settlementStartTimeout = useRef<number | undefined>(undefined);
    const autoStopTimeout = useRef<number | undefined>(undefined);
    const initializedRef = useRef(false);

    const isRunning = useRef(false);

    // Track how many bodies have been registered for stacking
    const bodyCountRef = useRef(0);

    // Register Matter.js body in the physics world - spawn at bottom with physics
    const registerElement = useCallback(
      (id: string, element: HTMLElement, props: MatterBodyProps) => {
        if (!canvas.current || bodiesMap.current.has(id)) return;
        
        const width = element.offsetWidth;
        const height = element.offsetHeight;
        const canvasRect = canvas.current!.getBoundingClientRect();

        const angleRad = ((props.angle || 0) * Math.PI) / 180;

        // Calculate position at the bottom of the container with some randomness
        const bodyIndex = bodyCountRef.current++;
        const padding = 30;
        const floorY = canvasRect.height - height / 2 - padding;
        
        // Distribute bodies across the bottom with some variation
        const totalBodies = 10;
        const segmentWidth = (canvasRect.width - padding * 2) / totalBodies;
        const baseX = padding + segmentWidth / 2 + (bodyIndex % totalBodies) * segmentWidth;
        const randomOffsetX = (Math.random() - 0.5) * segmentWidth * 0.6;
        const x = Math.max(padding + width / 2, Math.min(canvasRect.width - padding - width / 2, baseX + randomOffsetX));
        
        // Stack bodies with more vertical spacing to prevent overlap
        const stackOffset = Math.floor(bodyIndex / totalBodies) * (height + 20);
        const y = floorY - stackOffset;

        // Enhanced physics options for better collision and interaction
        const physicsOptions = {
          ...props.matterBodyOptions,
          friction: 0.8,
          frictionAir: 0.02,
          restitution: 0.3,
          density: 0.002,
          slop: 0.01, // Reduce overlap
          isStatic: false, // Start dynamic for proper physics
          angle: angleRad,
          render: {
            fillStyle: debug ? "#888888" : "#00000000",
            strokeStyle: debug ? "#333333" : "#00000000",
            lineWidth: debug ? 3 : 0,
          },
        };

        let body;
        if (props.bodyType === "circle") {
          const radius = Math.max(width, height) / 2;
          body = Bodies.circle(x, y, radius, physicsOptions);
        } else {
          body = Bodies.rectangle(x, y, width, height, physicsOptions);
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

    // Check if all bodies have settled (stopped moving) after user interaction
    const checkSettlement = useCallback(() => {
      if (bodiesMap.current.size === 0) return;

      let allSettled = true;
      let hasDynamicBodies = false;
      
      bodiesMap.current.forEach(({ body }) => {
        if (body.isStatic) return;
        hasDynamicBodies = true;

        const { x, y } = body.velocity;
        const av = body.angularVelocity;

        if (Math.abs(x) > 0.02 || Math.abs(y) > 0.02 || Math.abs(av) > 0.002) {
          allSettled = false;
        }
      });

      // If no dynamic bodies or not all settled, keep running
      if (!hasDynamicBodies || !allSettled) return;

      // Don't stop the engine or make bodies static - keep them interactive
      // Just clear the settlement check interval
      if (settlementCheckInterval.current) {
        clearInterval(settlementCheckInterval.current);
        settlementCheckInterval.current = undefined;
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

      // Keep sleeping OFF so bodies are always draggable/liftable
      engine.current.enableSleeping = false;
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

      // Make sure the debug canvas never blocks interaction with the HTML keywords
      render.current.canvas.style.position = "absolute";
      render.current.canvas.style.top = "0";
      render.current.canvas.style.left = "0";
      render.current.canvas.style.width = "100%";
      render.current.canvas.style.height = "100%";
      render.current.canvas.style.pointerEvents = "none";
      render.current.canvas.style.zIndex = "0";

      canvas.current.style.touchAction = "none";

      // Pointer-driven dragging with enhanced mobile support
      const getLocalPoint = (e: PointerEvent) => {
        const rect = canvas.current!.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
      };

      // Expanded hit detection for mobile - add padding around bodies
      const bodiesAtPoint = (point: { x: number; y: number }, expandRadius = 0) => {
        const bodies = Array.from(bodiesMap.current.values()).map((v) => v.body);
        
        if (expandRadius > 0) {
          // Check with expanded bounds for mobile
          return bodies.filter((body) => {
            const bounds = body.bounds;
            const expandedBounds = {
              min: { x: bounds.min.x - expandRadius, y: bounds.min.y - expandRadius },
              max: { x: bounds.max.x + expandRadius, y: bounds.max.y + expandRadius }
            };
            return (
              point.x >= expandedBounds.min.x &&
              point.x <= expandedBounds.max.x &&
              point.y >= expandedBounds.min.y &&
              point.y <= expandedBounds.max.y
            );
          });
        }
        
        return Query.point(bodies, point);
      };

      if (!pointerHandlersRef.current) {
        const down = (e: PointerEvent) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          if (!canvas.current) return;

          const point = getLocalPoint(e);
          // Use expanded hit area for touch devices (20px padding)
          const expandRadius = e.pointerType === "touch" ? 20 : 0;
          const hits = bodiesAtPoint(point, expandRadius);
          const body = hits[hits.length - 1];
          if (!body) return;

          // Make sure body is dynamic and awake
          Matter.Body.setStatic(body, false);
          Matter.Sleeping.set(body, false);

          // Haptic feedback on grab
          if (enableHaptics) {
            triggerHaptic('grab');
          }

          const constraint = Constraint.create({
            pointA: point,
            bodyB: body,
            pointB: { x: body.position.x - point.x, y: body.position.y - point.y },
            // Stronger stiffness for more responsive mobile dragging
            stiffness: e.pointerType === "touch" ? 0.35 : 0.22,
            damping: e.pointerType === "touch" ? 0.15 : 0.12,
            length: 0,
          });

          World.add(engine.current.world, constraint);
          activeDragRef.current = { pointerId: e.pointerId, constraint, body };

          // Strong pointer capture for mobile
          try {
            canvas.current.setPointerCapture(e.pointerId);
          } catch {
            // Some browsers may not support this
          }
          if (grabCursor) canvas.current.style.cursor = "grabbing";
          e.preventDefault();
          e.stopPropagation();
        };

        const move = (e: PointerEvent) => {
          if (!canvas.current) return;

          const active = activeDragRef.current;
          const point = getLocalPoint(e);

          if (active && active.pointerId === e.pointerId) {
            active.constraint.pointA = point;
            Matter.Sleeping.set(active.body, false);
            // Prevent "slingshot" velocities when releasing
            Matter.Body.setVelocity(active.body, { x: 0, y: 0 });
            e.preventDefault();
            return;
          }

          if (!grabCursor) return;
          const hovering = bodiesAtPoint(point).length > 0;
          canvas.current.style.cursor = hovering ? "grab" : "default";
        };

        const up = (e: PointerEvent) => {
          if (!canvas.current) return;
          const active = activeDragRef.current;
          if (!active || active.pointerId !== e.pointerId) return;

          // Haptic feedback on release
          if (enableHaptics) {
            triggerHaptic('release');
          }

          World.remove(engine.current.world, active.constraint);
          activeDragRef.current = null;

          if (grabCursor) canvas.current.style.cursor = "default";
          try {
            canvas.current.releasePointerCapture(e.pointerId);
          } catch {
            // ignore
          }
          e.preventDefault();
          e.stopPropagation();
        };

        const cancel = (e: PointerEvent) => {
          up(e);
        };

        pointerHandlersRef.current = { down, move, up, cancel };
        canvas.current.addEventListener("pointerdown", down, { passive: false });
        canvas.current.addEventListener("pointermove", move, { passive: false });
        canvas.current.addEventListener("pointerup", up, { passive: false });
        canvas.current.addEventListener("pointercancel", cancel, { passive: false });
      }

      // Ensure already-registered keyword bodies are present (needed after re-init)
      const existingBodies = new Set(engine.current.world.bodies);
      const bodiesToAdd = Array.from(bodiesMap.current.values())
        .map((v) => v.body)
        .filter((b) => !existingBodies.has(b));
      if (bodiesToAdd.length) {
        World.add(engine.current.world, bodiesToAdd);
      }

      // Add walls with proper boundaries
      const wallThickness = 50;
      const walls = [
        // Floor
        Bodies.rectangle(
          width / 2,
          height + wallThickness / 2,
          width + wallThickness * 2,
          wallThickness,
          {
            isStatic: true,
            friction: 1,
            render: {
              visible: debug,
            },
          }
        ),

        // Right wall
        Bodies.rectangle(
          width + wallThickness / 2,
          height / 2,
          wallThickness,
          height + wallThickness * 2,
          {
            isStatic: true,
            friction: 1,
            render: {
              visible: debug,
            },
          }
        ),

        // Left wall
        Bodies.rectangle(
          -wallThickness / 2,
          height / 2,
          wallThickness,
          height + wallThickness * 2,
          {
            isStatic: true,
            friction: 1,
            render: {
              visible: debug,
            },
          }
        ),
      ];

      // Top wall
      const topWall = Bodies.rectangle(
        width / 2,
        -wallThickness / 2,
        width + wallThickness * 2,
        wallThickness,
        {
          isStatic: true,
          friction: 1,
          render: {
            visible: debug,
          },
        }
      );

      if (addTopWall) {
        walls.push(topWall);
      }

      World.add(engine.current.world, walls);

      runner.current = Runner.create();
      Render.run(render.current);

      // Start the physics engine and keep it running for interactivity
      runner.current.enabled = true;
      Runner.run(runner.current, engine.current);
      isRunning.current = true;
      frameId.current = requestAnimationFrame(updateElements);
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
      if (settlementStartTimeout.current) {
        clearTimeout(settlementStartTimeout.current);
        settlementStartTimeout.current = undefined;
      }
      if (autoStopTimeout.current) {
        clearTimeout(autoStopTimeout.current);
        autoStopTimeout.current = undefined;
      }

      if (activeDragRef.current) {
        World.remove(engine.current.world, activeDragRef.current.constraint);
        activeDragRef.current = null;
      }

      if (pointerHandlersRef.current && canvas.current) {
        const { down, move, up, cancel } = pointerHandlersRef.current;
        canvas.current.removeEventListener("pointerdown", down);
        canvas.current.removeEventListener("pointermove", move);
        canvas.current.removeEventListener("pointerup", up);
        canvas.current.removeEventListener("pointercancel", cancel);
        pointerHandlersRef.current = null;
      }

      if (render.current) {
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

      // Keep bodiesMap so we can re-add bodies after a re-init (e.g., resize)
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
      hasSettled.current = false;

      // Put everything back into a free, dynamic state
      bodiesMap.current.forEach(({ body }) => {
        Matter.Body.setVelocity(body, { x: 0, y: 0 });
        Matter.Body.setAngularVelocity(body, 0);
        Matter.Body.setStatic(body, false);
        Matter.Sleeping.set(body, false);
      });

      // Ensure the simulation is running
      startEngine();
    }, [startEngine]);

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

    const contextValue = useMemo(
      () => ({ registerElement, unregisterElement }),
      [registerElement, unregisterElement]
    );

    return (
      <GravityContext.Provider value={contextValue}>
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
