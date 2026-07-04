export interface SteeringAgent {
  object: {
    position: { x: number; z: number };
  };
  radius: number;
  speciesId: string;
  state: 'idle' | 'walking';
  target: { x: number; z: number };
}

/**
 * Computes flocking steering forces (Separation, Alignment, Cohesion)
 * for a given agent relative to other agents.
 */
export function computeFlockingSteering(
  agent: SteeringAgent,
  others: SteeringAgent[],
  flockRange = 2.0,
  separationRange = 0.35
): { x: number; z: number } {
  const dx = agent.target.x - agent.object.position.x;
  const dz = agent.target.z - agent.object.position.z;
  const distToTarget = Math.hypot(dx, dz);

  if (distToTarget < 0.0001) {
    return { x: 0, z: 0 };
  }

  const steerX = dx / distToTarget;
  const steerZ = dz / distToTarget;

  let sepX = 0;
  let sepZ = 0;
  let alignX = 0;
  let alignZ = 0;
  let cohX = 0;
  let cohZ = 0;

  let neighborCount = 0;
  let walkingNeighborCount = 0;

  others.forEach((other) => {
    if (other === agent) return;

    const ox = agent.object.position.x - other.object.position.x;
    const oz = agent.object.position.z - other.object.position.z;
    const d = Math.hypot(ox, oz);

    if (d > 0.0001 && d < flockRange) {
      // 1. Separation: steer away from any neighbor that is too close (inverse distance for early, strong avoidance)
      const minDist = agent.radius + other.radius + separationRange;
      if (d < minDist) {
        const push = (minDist - d) / (d + 0.001);
        sepX += (ox / d) * push;
        sepZ += (oz / d) * push;
      }

      // 2. Alignment & 3. Cohesion: only applies to flockmates of the same species
      if (other.speciesId === agent.speciesId) {
        neighborCount++;
        cohX += other.object.position.x;
        cohZ += other.object.position.z;

        if (other.state === 'walking') {
          const otherDx = other.target.x - other.object.position.x;
          const otherDz = other.target.z - other.object.position.z;
          const otherDist = Math.hypot(otherDx, otherDz);
          if (otherDist > 0.0001) {
            alignX += otherDx / otherDist;
            alignZ += otherDz / otherDist;
            walkingNeighborCount++;
          }
        }
      }
    }
  });

  // Compute alignment force
  if (walkingNeighborCount > 0) {
    alignX /= walkingNeighborCount;
    alignZ /= walkingNeighborCount;
    const alignLen = Math.hypot(alignX, alignZ);
    if (alignLen > 0.0001) {
      alignX /= alignLen;
      alignZ /= alignLen;
    }
  }

  // Compute cohesion force
  if (neighborCount > 0) {
    // Get average position
    cohX /= neighborCount;
    cohZ /= neighborCount;

    // Calculate distance to the center of mass
    const distToCenter = Math.hypot(cohX - agent.object.position.x, cohZ - agent.object.position.z);

    // If the flock is already very close together, fade out cohesion to avoid over-packing.
    // Full cohesion at dist >= 1.5, fades to 0 at dist <= 0.8
    const cohesionFactor = Math.max(0, Math.min(1, (distToCenter - 0.8) / 0.7));

    // Vector pointing to average position
    cohX -= agent.object.position.x;
    cohZ -= agent.object.position.z;
    const cohLen = Math.hypot(cohX, cohZ);
    if (cohLen > 0.0001) {
      cohX = (cohX / cohLen) * cohesionFactor;
      cohZ = (cohZ / cohLen) * cohesionFactor;
    }

    // If seeking target is in opposite direction of cohesion, suppress cohesion
    // to allow the animal to break away from the herd easily.
    const dot = steerX * cohX + steerZ * cohZ;
    if (dot < 0) {
      cohX *= 0.15;
      cohZ *= 0.15;
    }
  }

  // Clamp separation force to prevent extreme values and keep movement smooth
  const sepLen = Math.hypot(sepX, sepZ);
  if (sepLen > 2.0) {
    sepX = (sepX / sepLen) * 2.0;
    sepZ = (sepZ / sepLen) * 2.0;
  }

  // Combine steering forces: target seeking (1.0), separation (2.5), alignment (0.3), cohesion (0.3)
  let moveX = steerX * 1.0 + sepX * 2.5 + alignX * 0.3 + cohX * 0.3;
  let moveZ = steerZ * 1.0 + sepZ * 2.5 + alignZ * 0.3 + cohZ * 0.3;

  const moveLen = Math.hypot(moveX, moveZ);
  if (moveLen > 0.0001) {
    moveX /= moveLen;
    moveZ /= moveLen;
  } else {
    moveX = steerX;
    moveZ = steerZ;
  }

  return { x: moveX, z: moveZ };
}
