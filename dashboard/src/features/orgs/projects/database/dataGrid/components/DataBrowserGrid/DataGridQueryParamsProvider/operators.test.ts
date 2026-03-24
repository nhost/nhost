import { getAvailableOperators } from './operators';

describe('getAvailableOperators', () => {
  it('should not include jsonb operators for non-jsonb columns', () => {
    const ops = getAvailableOperators('text');
    const opValues = ops.map((o) => o.op);

    expect(opValues).not.toContain('@>');
    expect(opValues).not.toContain('<@');
    expect(opValues).not.toContain('?');
    expect(opValues).not.toContain('?|');
    expect(opValues).not.toContain('?&');
  });

  it('should include comparison and text operators for non-jsonb columns', () => {
    const ops = getAvailableOperators('text');
    const opValues = ops.map((o) => o.op);

    expect(opValues).toContain('=');
    expect(opValues).toContain('<>');
    expect(opValues).toContain('IS');
    expect(opValues).toContain('IS NOT');
    expect(opValues).toContain('IN');
    expect(opValues).toContain('>');
    expect(opValues).toContain('LIKE');
    expect(opValues).toContain('ILIKE');
    expect(opValues).toContain('~');
  });

  it('should include jsonb operators for jsonb columns', () => {
    const ops = getAvailableOperators('jsonb');
    const opValues = ops.map((o) => o.op);

    expect(opValues).toContain('@>');
    expect(opValues).toContain('<@');
    expect(opValues).toContain('?');
    expect(opValues).toContain('?|');
    expect(opValues).toContain('?&');
  });

  it('should only include common and jsonb operators for jsonb columns', () => {
    const ops = getAvailableOperators('jsonb');
    const opValues = ops.map((o) => o.op);

    expect(opValues).toContain('=');
    expect(opValues).toContain('<>');
    expect(opValues).toContain('IS');
    expect(opValues).toContain('IS NOT');
    expect(opValues).not.toContain('IN');
    expect(opValues).not.toContain('>');
    expect(opValues).not.toContain('LIKE');
    expect(opValues).not.toContain('~');
  });

  it('should return the same operators as non-jsonb when dataType is undefined', () => {
    const opsUndefined = getAvailableOperators(undefined);
    const opsText = getAvailableOperators('text');

    expect(opsUndefined).toEqual(opsText);
  });
});
