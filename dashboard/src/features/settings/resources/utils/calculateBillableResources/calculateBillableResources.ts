/**
 * Calculate the approximate cost of a list of services.
 *
 * @param services - The list of services to calculate the cost of.
 * @returns The approximate cost of the services.
 */
export default function calculateBillableResources(
  ...services: { replicas?: number; vcpu?: number; memory?: number }[]
) {
  return services.reduce(
    (total, { replicas, vcpu, memory }) => {
      if (!replicas || (!vcpu && !memory)) {
        return total;
      }

      if (!vcpu && memory) {
        return {
          ...total,
          memory: total.memory + memory * replicas,
        };
      }

      if (vcpu && !memory) {
        return {
          ...total,
          vcpu: total.vcpu + vcpu * replicas,
        };
      }

      return {
        vcpu: total.vcpu + vcpu * replicas,
        memory: total.memory + memory * replicas,
      };
    },
    { vcpu: 0, memory: 0 } as { vcpu: number; memory: number },
  );
}
