package project

import (
	"github.com/nhost/be/services/mimir/model"
)

const (
	DefaultPubKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqSFS8Kx9LuiYpIms+NoZ
dSIcIgVp3z531bCSq1shx6ZqsKxHyNAjQ9vcYDBcW1gS1q0NFCDWyDLoNyd/lYUD
lsc6zjXZAGyjiT1l/Qe9USHjXhT6Yv8SQlVbj8YCYPhYV9g6Bj922gXOmwXpWToH
VYK5bjZmq897doksTErKiny6+FlPJvLVp3cpTFuNy6DKkZkIliuZnmf8EMFOVoFu
QtNVlDZZZjk9TK9SP+qN1bvFPTdlCxdkA8ws8IkvhFivgfOflLRlzEE4fECEkaC3
tZzGzjhPOmV5T8UC8eNz0Ir87nez8/fVyq61ffPkFftfGOjZ4hUfQqn+YW4sH/VT
jwIDAQAB
-----END PUBLIC KEY-----`

	DefaultPrivKey = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCpIVLwrH0u6Jik
iaz42hl1IhwiBWnfPnfVsJKrWyHHpmqwrEfI0CND29xgMFxbWBLWrQ0UINbIMug3
J3+VhQOWxzrONdkAbKOJPWX9B71RIeNeFPpi/xJCVVuPxgJg+FhX2DoGP3baBc6b
BelZOgdVgrluNmarz3t2iSxMSsqKfLr4WU8m8tWndylMW43LoMqRmQiWK5meZ/wQ
wU5WgW5C01WUNllmOT1Mr1I/6o3Vu8U9N2ULF2QDzCzwiS+EWK+B85+UtGXMQTh8
QISRoLe1nMbOOE86ZXlPxQLx43PQivzud7Pz99XKrrV98+QV+18Y6NniFR9Cqf5h
biwf9VOPAgMBAAECggEAN08miH5gEc8O3AAKCPeKC7wz5wxOKyuKlN9Bl7gdu+S4
Tz6H2yv13GMyFmK6UUTkJEBDXqm+k4nSVvcbyhHNsqlEmdsSNAlTEbZ6e9zkFHw4
lrPVjjpMBlVTtBjU/lE40sFreE+Y1oO/pQKx5PQNIfG2Iky4FserYIBLdEehJNhN
CRX6IdCbgI4ZaRQCWAUVHbUKALN/8K4Yt1QegUNIyJwQQIlL3N+oHGtYbGef2Op0
RvYLteA7PMntM5jJ2lUMt+6BEIbbZ0XgfS1y4dxTSl3TtQaJN2CMb1TcSz3VYgYd
sqxylQDa23eMzxWMS2URJDX5A0OROVmhlrVs6j/BQQKBgQDeMvBgkutVvQLoqgoz
V6TWVn96qrKCXir2PznVn5zwvkIGXInXiy09Qd20+VnWT1jZDa6/WAB6PyQ20EKe
e9/0GIOfL3MlqiPxKCScmYf/vrUkXuO3IbtJCbHCcYkSYzIcZmm8cGDqumyWxp3K
fMEdg8gl2cXGrO7J8IG+sgKe+wKBgQDC27wHbQJGqaWJdYgpq5sXpkpK3XSv/5Gr
pHat4D9v5u87krjgk1YX+ohb6rvDRaqHc1oslKermHJUYDpdlekeox2209EEt+8g
ftkcP2RvQqtDzGCPVHaKrE6M2d2TBgHTt53o+MxWOl7hMW5tS88tTxgi3XH64Rer
gJtZ2A6pfQKBgQDKJr3ans/MKTHESy8Mlug4uGkySKovQU0Ey3DqkVRPEkkvUHF3
z/9Qg+QZCeJZv8atcm1RV9bXYSqpU7/IQBr4EHVvFdREqA4bENJ+RpAcdHyIomu5
6M5jHJbEuFZkjCrC+8mmzvbdls3EPt6/odBv8bzd8sqkfiChSFZCD+GikQKBgDqJ
mGsCrHRd8oTg8g7SprzsD9V9wdg9hp1xwtVpUKVlUukqoq+Uk4CQmvZCBjYbb6dR
V/2ciuJZ4b7HScFjj6zMg9iwuVIZj5TLhp2dzaY++QRdGYT1cscmDFL0AERywYnA
14dtdrVQw8ATAYGEDLEn2bBfpiYgCORUtla/OWhhAoGBAKDuxNcT4FGhNwTvsyZR
IeLjeQe+DF4KrAuIjg3W3oM5Q6/iNXZbTpeiCEXuQtgOdjtiJ62PbW+ow78mH5mf
c8v41oQURBPIkvv3oAmr3AA6ZES5JawUjEA4wa1J8+SQHsn6qWQYCa1VhcZ60zPU
s6fJmz3ZeArPI8KFSI3Q2xqm
-----END PRIVATE KEY-----`

	DefaultNhostKID = "49C0CEDD-255D-43DA-8880-30440B24F784"
)

func DefaultSecrets() model.Secrets {
	return model.Secrets{
		{
			Name:  "HASURA_GRAPHQL_ADMIN_SECRET",
			Value: "nhost-admin-secret",
		},
		{
			Name:  "NHOST_JWT_PUBLIC_KEY",
			Value: DefaultPubKey,
		},
		{
			Name:  "NHOST_JWT_PRIVATE_KEY",
			Value: DefaultPrivKey,
		},
		{
			Name:  "NHOST_JWT_KID",
			Value: DefaultNhostKID,
		},
		{
			Name:  "NHOST_WEBHOOK_SECRET",
			Value: "nhost-webhook-secret",
		},
		{
			Name:  "GRAFANA_ADMIN_PASSWORD",
			Value: "grafana-admin-password",
		},
	}
}
