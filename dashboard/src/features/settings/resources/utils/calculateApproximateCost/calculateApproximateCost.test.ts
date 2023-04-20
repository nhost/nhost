import calculateApproximateCost from './calculateApproximateCost';

test('should return zero if no services are provided', () => {
  expect(calculateApproximateCost(25)).toBe(0);
});

test('should return the correct cost for a single service', () => {
  expect(calculateApproximateCost(25, { replicas: 1, vcpu: 250 })).toBe(6.25);
});

test('should return the correct cost for multiple services', () => {
  expect(
    calculateApproximateCost(
      25,
      { replicas: 1, vcpu: 250 },
      { replicas: 1, vcpu: 250 },
    ),
  ).toBe(12.5);
});

test('should return the correct cost for multiple services with different vCPU and replica counts', () => {
  expect(
    calculateApproximateCost(
      25,
      { replicas: 2, vcpu: 250 },
      { replicas: 1, vcpu: 500 },
    ),
  ).toBe(25);
});

test('should not count services with no replicas or vCPU', () => {
  expect(
    calculateApproximateCost(
      25,
      { replicas: 1, vcpu: 250 },
      { replicas: 1 },
      { vcpu: 250 },
    ),
  ).toBe(6.25);
});
