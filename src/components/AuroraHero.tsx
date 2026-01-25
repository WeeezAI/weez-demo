import { useEffect, useRef } from "react";

const AuroraHero = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let animationFrameId: number;
        let t = 0;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        window.addEventListener("resize", resize);
        resize();

        // Vibrant Blobs
        const blobs = [
            { x: 0, y: 0, r: 0, color: "rgba(124, 58, 237, 0.4)", speed: 0.002, offset: 0 }, // Violet
            { x: 0, y: 0, r: 0, color: "rgba(59, 130, 246, 0.3)", speed: 0.003, offset: 2 }, // Blue
            { x: 0, y: 0, r: 0, color: "rgba(236, 72, 153, 0.3)", speed: 0.002, offset: 4 }, // Pink
            { x: 0, y: 0, r: 0, color: "rgba(16, 185, 129, 0.2)", speed: 0.004, offset: 5 }, // Emerald Accent
        ];

        // Star Particles
        const particles = Array.from({ length: 50 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2,
            speedY: Math.random() * 0.5 + 0.1,
            opacity: Math.random() * 0.5 + 0.2,
        }));

        const render = () => {
            t += 1;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 1. Draw Vibrant Aurora Mesh
            blobs.forEach((blob) => {
                const x = canvas.width * 0.5 + Math.cos(t * blob.speed + blob.offset) * (canvas.width * 0.35);
                const y = canvas.height * 0.5 + Math.sin(t * blob.speed * 1.2 + blob.offset) * (canvas.height * 0.25);
                const radius = Math.min(canvas.width, canvas.height) * 0.7;

                const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
                gradient.addColorStop(0, blob.color);
                gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

                ctx.globalCompositeOperation = "screen"; // Blend mode for vibrance
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
            });

            // 2. Draw Floating Particles (Stars)
            ctx.globalCompositeOperation = "source-over"; // Reset blend mode
            particles.forEach((p) => {
                p.y -= p.speedY; // Move up
                if (p.y < 0) {
                    p.y = canvas.height;
                    p.x = Math.random() * canvas.width;
                }

                ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            window.removeEventListener("resize", resize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ filter: "blur(40px)" }} // Reduced blur for slightly clearer shapes
        />
    );
};

export default AuroraHero;
