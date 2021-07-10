import { Response } from "superagent";

export function end(done: any) {
  return (err: any, res: Response) => {
    if (err) return done(err);
    else return done();
  };
}

export function statusCode(status: number) {
  return (res: Response) => {
    if (res.status !== status) {
      throw new Error(
        `Expected status code ${status} but instead received ${res.status} ${
          res.body.message || res.text
        }`
      );
    }
  };
}

export function validJwt() {
  return (res: Response) => {
    expect(res.body.jwtToken).toBeString();
    expect(res.body.jwtExpiresIn).toBeNumber();
  };
}

export function saveJwt(fn: (jwtToken: string) => any) {
  return (res: Response) => {
    fn(res.body.jwtToken);
  };
}

export function saveRefreshToken(fn: (refreshToken: string) => any) {
  return (res: Response) => {
    fn(res.body.refreshToken);
  };
}

export function validRefreshToken(
  regex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/
) {
  return (res: Response) => {
    expect(res.body.refreshToken).toMatch(regex);
  };
}
