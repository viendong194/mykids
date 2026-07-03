const CONFETTI_COLORS = ['#FF2E93', '#FF8E53', '#FFF02E', '#2EFF8B', '#2EC6FF', '#AB2EFF'];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  life: number;
}

/**
 * Lightweight canvas confetti burst for the DOM/Three.js overlay.
 * src/components/Confetti.ts can't be reused here — it's built on Phaser's
 * particle emitter and requires a Phaser.Scene.
 */
export class DomConfetti {
  public static burst(container: HTMLElement, x: number, y: number, count = 36) {
    const canvas = document.createElement('canvas');
    canvas.className = 'zoo3d-confetti-canvas';
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.pointerEvents = 'none';
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      canvas.remove();
      return;
    }

    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 220;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        size: 5 + Math.random() * 5,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10,
        life: 1,
      });
    }

    const gravity = 500;
    let lastTime = performance.now();
    let rafId: number;

    const step = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      for (const p of particles) {
        p.life -= dt * 0.7;
        if (p.life <= 0) continue;
        alive = true;

        p.vy += gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.rotationSpeed * dt;

        ctx.save();
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }

      if (alive) {
        rafId = requestAnimationFrame(step);
      } else {
        canvas.remove();
      }
    };

    rafId = requestAnimationFrame(step);

    // Safety net in case the tab is backgrounded and rAF stalls indefinitely.
    setTimeout(() => {
      cancelAnimationFrame(rafId);
      canvas.remove();
    }, 3000);
  }
}
