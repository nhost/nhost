import { Response } from 'superagent'

export function end(done: any) {
  return (err: any, res: Response) => {
    if (err) return done(err);
    else return done();
  }
}

export function statusCode(status: number) {
  return (res: Response) => {
    if(res.status !== status) {
      throw new Error(`Expected status code ${status} but instead received ${res.status} ${res.body.message}`)
    }
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
