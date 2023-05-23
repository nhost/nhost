import calculateBillableResources from './calculateBillableResources';

test('should return zero if no services are provided', () => {
  expect(calculateBillableResources()).toMatchObject({ vcpu: 0, memory: 0 });
});

test('should return the correct cost for a single service', () => {
  expect(
    calculateBillableResources({ replicas: 1, vcpu: 250, memory: 500 }),
  ).toMatchObject({
    vcpu: 250,
    memory: 500,
  });
});

test('should return the correct cost for multiple services', () => {
  expect(
    calculateBillableResources(
      { replicas: 1, vcpu: 250, memory: 250 },
      { replicas: 1, vcpu: 250, memory: 500 },
    ),
  ).toMatchObject({ vcpu: 500, memory: 750 });
});

test('should return the correct cost for multiple services with different vCPU and replica counts', () => {
  expect(
    calculateBillableResources(
      { replicas: 2, vcpu: 250, memory: 500 },
      { replicas: 1, vcpu: 500, memory: 750 },
    ),
  ).toMatchObject({ vcpu: 1000, memory: 1750 });
});

test('should not count services with no replicas or vCPU and memory', () => {
  expect(
    calculateBillableResources(
      // should count
      { replicas: 1, vcpu: 250 },
      // shouldn't count
      { replicas: 1 },
      // shouldn't count
      { vcpu: 250, memory: 1000 },
      // should count
      { replicas: 1, memory: 500 },
    ),
  ).toMatchObject({ vcpu: 250, memory: 500 });
});
