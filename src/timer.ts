let timer = Date.now();

export const tag = (msg = 'Time elapsed') => {
  const now = Date.now();
  const diff = now - timer;
  console.log(`${msg}: ${diff}ms`);
  timer = now;
};
