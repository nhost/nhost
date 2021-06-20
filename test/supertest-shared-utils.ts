import { Response } from 'superagent'

export function end(done: any) {
  return (err: Response) => {
    if (err) return done(err);
    else return done();
  }
}

export function validJwt() {
  return (res: Response) => {
    expect(res.body.jwt_token).toBeString()
    expect(res.body.jwt_expires_in).toBeNumber()
  }
}

export function saveJwt(fn: (jwtToken: string) => any) {
  return (res: Response) => {
    fn(res.body.jwt_token)
  }
}

export function saveRefreshToken(fn: (refreshToken: string) => any) {
  return (res: Response) => {
    fn(res.body.refresh_token)
  }
}

export function validRefreshToken(regex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/) {
  return (res: Response) => {
    expect(res.body.refresh_token).toMatch(regex)
  }
}
