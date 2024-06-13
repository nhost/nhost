package controller_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/controller"
	"github.com/nhost/hasura-auth/go/controller/mock"
	"github.com/nhost/hasura-auth/go/notifications"
	"github.com/nhost/hasura-auth/go/sql"
	"github.com/nhost/hasura-auth/go/testhelpers"
	"github.com/oapi-codegen/runtime/types"
	"go.uber.org/mock/gomock"
)

func webAuthnTouchID(
	t *testing.T,
) (*protocol.CredentialCreationResponse, controller.WebauthnChallenge) {
	t.Helper()

	//nolint:lll
	rawCredResp := []byte(`{
        "id": "LychOomEPgZu4XNwiDvzlP5hd1U",
        "rawId": "LychOomEPgZu4XNwiDvzlP5hd1U",
        "response": {
            "attestationObject": "o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YViY0RE6Bmg2J-FxNrC8136ZQSeTWKWtdni_Lpfv5XR4bDtdAAAAAPv8MAcVTk7MjAtuAgVX170AFC8nITqJhD4GbuFzcIg785T-YXdVpQECAyYgASFYIFfhtYKglcQa82Wd3cJoz2Y1JTKlhiL798bGCG2pyWR_Ilggo1CUEbgnUq5G7FY6OzptcSQQZq6yV3XVu5iM0MWRH2U",
            "clientDataJSON": "eyJjaGFsbGVuZ2UiOiJ6em56dGp2RlZVTTBFMnA4WlY2c2hYRWN3MmY0dGJ6NVJyZlpXazRWUFhJIiwib3JpZ2luIjoiaHR0cHM6Ly9yZWFjdC1hcG9sbG8uZXhhbXBsZS5uaG9zdC5pbyIsInR5cGUiOiJ3ZWJhdXRobi5jcmVhdGUifQ",
            "transports": [
                "internal"
            ],
            "publicKeyAlgorithm": -7,
            "publicKey": "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEV-G1gqCVxBrzZZ3dwmjPZjUlMqWGIvv3xsYIbanJZH-jUJQRuCdSrkbsVjo7Om1xJBBmrrJXddW7mIzQxZEfZQ",
            "authenticatorData": "0RE6Bmg2J-FxNrC8136ZQSeTWKWtdni_Lpfv5XR4bDtdAAAAAPv8MAcVTk7MjAtuAgVX170AFC8nITqJhD4GbuFzcIg785T-YXdVpQECAyYgASFYIFfhtYKglcQa82Wd3cJoz2Y1JTKlhiL798bGCG2pyWR_Ilggo1CUEbgnUq5G7FY6OzptcSQQZq6yV3XVu5iM0MWRH2U"
        },
        "type": "public-key",
        "clientExtensionResults": {},
        "authenticatorAttachment": "platform"
    }`)

	var resp *protocol.CredentialCreationResponse
	if err := json.Unmarshal(rawCredResp, &resp); err != nil {
		t.Fatal(err)
	}

	rawChallenge := []byte(`{
          "Session": {
            "challenge": "zznztjvFVUM0E2p8ZV6shXEcw2f4tbz5RrfZWk4VPXI",
            "user_id": "Y2Y5MWQxYmMtODc1ZS00OWJjLTg5N2YtZmJjY2YzMmVkZTEx",
            "expires": "0001-01-01T00:00:00Z",
            "userVerification": "preferred"
          },
          "User": {
            "ID": "cf91d1bc-875e-49bc-897f-fbccf32ede11",
            "Name": "Jane Doe",
            "Email": "jane@acme.com"
          },
          "Options": {
            "allowedRoles": [
              "user",
              "me"
            ],
            "defaultRole": "user",
            "displayName": "Jane Doe",
            "locale": "en",
            "redirectTo": "http://localhost:3000"
          }
        }`)

	var challenge controller.WebauthnChallenge
	if err := json.Unmarshal(rawChallenge, &challenge); err != nil {
		t.Fatal(err)
	}

	return resp, challenge
}

func webAuthnWindowsHello(
	t *testing.T,
) (*protocol.CredentialCreationResponse, controller.WebauthnChallenge) {
	t.Helper()

	//nolint:lll
	rawCredResp := []byte(`{
        "id": "t4r2_E24k3bp-LwQUz5M2xazSsWfZpATRPtaelkfqfc",
        "rawId": "t4r2_E24k3bp-LwQUz5M2xazSsWfZpATRPtaelkfqfc",
        "response": {
            "attestationObject": "o2NmbXRjdHBtZ2F0dFN0bXSmY2FsZzn__mNzaWdZAQDD6T1Xbcklo2ZbVD93TxxUh4LIlQgJopKlIEiqFGsYcvrzzR4D6IdDN0uQbNRcoS1ZKmzQ_v2gXmj8yorBt9LJ8zN4jSzUjoq4Yp_yZrZtVFwnNTTvPdvMxMUQoMS-lbzTZz_-w1nrkfzkGs_r_Wks-i-wKo5gVi45t1mjjuYijdNBPNNBD9MFXLjQXgfIR8u1KxckxqdaxTSl2E4jzRuC5W7IY0a6XUrgz_Z6fI1C780XdvrkXdWeni-9l4Nj3e5cKtCjHvwx-01mcEU2Kk1t3s9xIegMGJ0rQvySIzkiL7PhiMbLp0eCjczUaFtI9FLvU1h69waTiOaUi-myUunZY3ZlcmMyLjBjeDVjglkFvTCCBbkwggOhoAMCAQICEDYL-Azg3EijplSpYoe60dswDQYJKoZIhvcNAQELBQAwQjFAMD4GA1UEAxM3TkNVLUlOVEMtS0VZSUQtRUE5NTBEOTg3QkNGRjBERjlBQUMxRkVGRkI4QUI0ODAzRkVGMkNBMjAeFw0yMzEyMDMwODIzMDVaFw0yODA1MTIyMDQ3NTdaMAAwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDFEDvH0Q1QuWKBNbm69EkzR9ybpL0_29R0vRIj2MahV9ZYK6FN_LjF12Ai7G7YTvGiIS5skMiFwzBhanIAcHpLZaaMb9Rywnp5cjp6414crt648nzvbq_oOQG_acO-LqfPTj2I-zhie3nAQz6r9KV7jK7I3p_-2DxRrHzyAlo71gOC8MsX0RARfbLslnsLGra_CWSATp3cEuTKh0PRsERNK85mSQ85pIiAUS5AAEFhk19sT3CJdjBr6sOz5cg0JO6hQ-upnrRK6yWJqF599OdN1Fm9uIX68mDiMl3fA3vwEItBe2lC4EJ_jkVs1KkLmvTQkPTRmgw6RAUFqS7HcCPRAgMBAAGjggHrMIIB5zAOBgNVHQ8BAf8EBAMCB4AwDAYDVR0TAQH_BAIwADBtBgNVHSABAf8EYzBhMF8GCSsGAQQBgjcVHzBSMFAGCCsGAQUFBwICMEQeQgBUAEMAUABBACAAIABUAHIAdQBzAHQAZQBkACAAIABQAGwAYQB0AGYAbwByAG0AIAAgAEkAZABlAG4AdABpAHQAeTAQBgNVHSUECTAHBgVngQUIAzBQBgNVHREBAf8ERjBEpEIwQDEWMBQGBWeBBQIBDAtpZDo0OTRFNTQ0MzEOMAwGBWeBBQICDANBREwxFjAUBgVngQUCAwwLaWQ6MDI1ODAwMTIwHwYDVR0jBBgwFoAUH5exkeyU6vAkYZshYb-lI1ji_rkwHQYDVR0OBBYEFPb2n64JiqOUAfDaHCOS6pBB74tOMIGzBggrBgEFBQcBAQSBpjCBozCBoAYIKwYBBQUHMAKGgZNodHRwOi8vYXpjc3Byb2RuY3VhaWtwdWJsaXNoLmJsb2IuY29yZS53aW5kb3dzLm5ldC9uY3UtaW50Yy1rZXlpZC1lYTk1MGQ5ODdiY2ZmMGRmOWFhYzFmZWZmYjhhYjQ4MDNmZWYyY2EyL2JmZWMyZGUwLWJjNzYtNGNlNi04ZWUwLTk3MjJhYWI1MjBlNS5jZXIwDQYJKoZIhvcNAQELBQADggIBADx3TcZ-t0jsuIOCv5Qa7QvfikgtiKV2BnwAfg_Sy_GfX4r3Wf5YL6B-GlGzdUv3aXWN8wucdVzoK-0MqVYCyIvUHwOZB-vxsTQl9vDIe144aHSHqUH8MkgxKixnMsi6-ODw-hDebWQxfSOXqqnG1s91qDiEXRcPFDtOTKlH4GS13nNNa8qfZf2NriuALFpqmmpooWbOJG857xgtLCIvMTiiW_oF55l-d6oqfK2rkfGWvIMXbKgaXFIC5mDEkIESSZCr4Fmdal51r3-lsk0-SBPu8tsapBlm1yHhWmjqHR8fsAtREj2Q4qegqozC38QBJgPJh047P3khL65W-iHc9_nI5b-QW3S3F4RYe8iGCvccz9PCHjjIgpgmPW0aaO4pVmDDTKokZAgWsc-t4h-xVSuEMAixjqvsalP1oSfzP8bAZwewOPSHLdtTFQnT_3JcusD31PThAyU5lC-VaI24I6wOk2F1Yrow3ze1jZXn4QVczhuA61ThbN-0fAfMh1KbrXjcJG5mOjV68yA0BwWxuOKYeT1u7uj6zt-yBBbNAvX_gSwrtQ0kSzMq2AvvlkVbyI25QnDYbKFHtbSdog4ghb018-q7rUepsqaDcolNWocqrNOiA785WvmSMi7b_szRr8fDUTcZCFJpxL4BMmmxbkhUc6Wkfs6q5cCsgk72PcBnWQbwMIIG7DCCBNSgAwIBAgITMwAAB4cFQab9pgXr9wAAAAAHhzANBgkqhkiG9w0BAQsFADCBjDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjE2MDQGA1UEAxMtTWljcm9zb2Z0IFRQTSBSb290IENlcnRpZmljYXRlIEF1dGhvcml0eSAyMDE0MB4XDTIyMDUxMjIwNDc1N1oXDTI4MDUxMjIwNDc1N1owQjFAMD4GA1UEAxM3TkNVLUlOVEMtS0VZSUQtRUE5NTBEOTg3QkNGRjBERjlBQUMxRkVGRkI4QUI0ODAzRkVGMkNBMjCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAM0r9233MxhyPRqWif286clCz-LmWAWLPcr6faoLCnJ300lt_XMArj0xZ9iSI5q1cPWTTa5J9RPS8Bs1rIzsdoJtJGz8m11UGfKmpQIjVc7-eXm8j47Zzjvcw99XjHwYnsCpEGw4-rEkh_yUMpWbqqUzS5nIb9Ce8g1b2cvh9bKv7qpqVspd0YmX819faMFbSBMI1ZT-fIpEm2PWVjivXnFdkKOv5hp_4aWlO9ivneZg685QN3TsAiooQ3n1hEgLESkK_1YsEWiI_iEGpXNuZSSokoLA9h-Mox-QUTrEEmc7A-g2mDoVYX4kCQrSEVGTEqAwuhUAtUrTzjGo6M2Re7ZS2Sr7JlVhpeXhCS3jqRkp6MJc5zSHP-0YyfsQ7fs4pA7DBF-5I_BX9oN-m64kNtr7BQHbnzeT-i-oqAn6KVbjbOqoAcZCWuVsoU2tnRrnTADH0rRREsQq-YOCcJU5aQ0GtEfVqM2arbeR2nmvqxEWp21mFTWwQfMQUnjhjiA1qzCqk8JbvuNfbU8jDy90L0RbUc75VQhFGRmu8BAyHjmN-nFR-cbwbBO40eV5Wz0282-tBRMX_TQAZjC_tK7idY2-M6MmABtor3bLR_ylJQg3r5Z3zQqY44u0zktB5WdVbSykr23oki4yT1DfZmzrxloUaLm6o0WfqIJdIZ3ATtwbAgMBAAGjggGOMIIBijAOBgNVHQ8BAf8EBAMCAoQwGwYDVR0lBBQwEgYJKwYBBAGCNxUkBgVngQUIAzAWBgNVHSAEDzANMAsGCSsGAQQBgjcVHzASBgNVHRMBAf8ECDAGAQH_AgEAMB0GA1UdDgQWBBQfl7GR7JTq8CRhmyFhv6UjWOL-uTAfBgNVHSMEGDAWgBR6jArOL0hiF-KU0a5VwVLscXSkVjBwBgNVHR8EaTBnMGWgY6Bhhl9odHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20vcGtpb3BzL2NybC9NaWNyb3NvZnQlMjBUUE0lMjBSb290JTIwQ2VydGlmaWNhdGUlMjBBdXRob3JpdHklMjAyMDE0LmNybDB9BggrBgEFBQcBAQRxMG8wbQYIKwYBBQUHMAKGYWh0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMvY2VydHMvTWljcm9zb2Z0JTIwVFBNJTIwUm9vdCUyMENlcnRpZmljYXRlJTIwQXV0aG9yaXR5JTIwMjAxNC5jcnQwDQYJKoZIhvcNAQELBQADggIBAHm8r8YHw3ozhenIyk4I5zVuDLol2FJiABcnWPk4DtzO63J7trqM2Cr_bsBUd2BDVxS8R9TQDR8iSXbPH_BbHHC7XYK2NjaGTHpV7f5GBloLDal-FXP0glD8bX7aOUp1ks4RJtv9scF8TnQgUtaWsweVi8sn1km4QLaE4tutdBkyvkIyR26ZihVm67Wmpg-JbQkt4ksB840YtmUgXbnmbV8byQQAvpYC5dl1aJBGSyz_sMgivHw11pXJAfgKurpwfG9IC5-k5-9vPa3XjyT484wT24R1gc4Zj_jEfh7z6w1ppxd9XbxYv0fHg5xCPoWt-tFndKuZOxDVWBnNzJ6zCw5Tezbax1PUpYljElwP2mylJkeK8EzbVwbMJUzW4uKKRe5kfTCxDT0gArVUWdqHhEY34rzkx9wI22f-mQl6NgcGW290AuEQ0L_Ni0Qqj_P2lC1YlTrAr90QxWEwouVZ7BLD9eHa_TBqelrE1kdd6NAzorU3m4aAVwW3BfEGxE54y5kSi8QTqC9CTsuAAGyPBuw0N_cr16KNus2F3pgNbQKHv7fblVaQNY4c9q0zL3nU1T4aVJGz8N0-hWc4H5j3hf3xhRL-jiNljBT2l11sOOmo4SjYCBRwdtBnVSJUrx4T2OrJ5klpUuZUrrbF7IO8IXxQTnsvI8g5MgDAKwtltBnHZ3B1YkFyZWFYdgAjAAsABAByACCd_8vzbDg65pn7mGjcbcuJ1xU4hL4oA5IsEkFYv60irgAQABAAAwAQACCc5JpkK9fmO9nCNd1rYQ7jd7GOro71OAkhaN4GxP2DdQAgsPo5B-oUPuIa2KCvefgsmxzDZdJDWjoRDa3v9zmTnrVoY2VydEluZm9Yof9UQ0eAFwAiAAt3Gqx7OUvHQid6kxmYviEHjoZ6nPhunCfjGfluPrvZWAAUaaePbyq16tk9DUi5NaYPaBbFKNYAAAACLwgJ6vX85sF7no1_ATCwK8mFs9NtACIAC9NjnLHa29t1i8vfJtZQytQSxB3v9YkNaBpktQ3nXitaACIAC7FXrVKJyNWcApoiMfNCaSiweyShCjhneC4Fx2mZoLKlaGF1dGhEYXRhWKTREToGaDYn4XE2sLzXfplBJ5NYpa12eL8ul-_ldHhsO0UAAAAACJhwWMrcS4G24TDeUNy-lgAgt4r2_E24k3bp-LwQUz5M2xazSsWfZpATRPtaelkfqfelAQIDJiABIVggnOSaZCvX5jvZwjXda2EO43exjq6O9TgJIWjeBsT9g3UiWCCw-jkH6hQ-4hrYoK95-CybHMNl0kNaOhENre_3OZOetQ",
            "clientDataJSON": "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoienY5bFBUSnBPbGd4emxyS1dsLXRHN0FkeGVVSWJDd3hxVjhNRlpaTlJkQSIsIm9yaWdpbiI6Imh0dHBzOi8vcmVhY3QtYXBvbGxvLmV4YW1wbGUubmhvc3QuaW8iLCJjcm9zc09yaWdpbiI6ZmFsc2V9",
            "transports": [
                "internal"
            ],
            "publicKeyAlgorithm": -7,
            "publicKey": "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEnOSaZCvX5jvZwjXda2EO43exjq6O9TgJIWjeBsT9g3Ww-jkH6hQ-4hrYoK95-CybHMNl0kNaOhENre_3OZOetQ",
            "authenticatorData": "0RE6Bmg2J-FxNrC8136ZQSeTWKWtdni_Lpfv5XR4bDtFAAAAAAiYcFjK3EuBtuEw3lDcvpYAILeK9vxNuJN26fi8EFM-TNsWs0rFn2aQE0T7WnpZH6n3pQECAyYgASFYIJzkmmQr1-Y72cI13WthDuN3sY6ujvU4CSFo3gbE_YN1IlggsPo5B-oUPuIa2KCvefgsmxzDZdJDWjoRDa3v9zmTnrU"
        },
        "type": "public-key",
        "clientExtensionResults": {
            "credProps": {
                "rk": true
            }
        },
        "authenticatorAttachment": "platform"
    }`)

	var resp *protocol.CredentialCreationResponse
	if err := json.Unmarshal(rawCredResp, &resp); err != nil {
		t.Fatal(err)
	}

	rawChallenge := []byte(`{
          "Session": {
            "challenge": "zv9lPTJpOlgxzlrKWl-tG7AdxeUIbCwxqV8MFZZNRdA",
            "user_id": "Y2Y5MWQxYmMtODc1ZS00OWJjLTg5N2YtZmJjY2YzMmVkZTEx",
            "expires": "0001-01-01T00:00:00Z",
            "userVerification": "preferred"
          },
          "User": {
            "ID": "cf91d1bc-875e-49bc-897f-fbccf32ede11",
            "Name": "Jane Doe",
            "Email": "jane@acme.com"
          },
          "Options": {
            "allowedRoles": [
              "user",
              "me"
            ],
            "defaultRole": "user",
            "displayName": "Jane Doe",
            "locale": "en",
            "redirectTo": "http://localhost:3000"
          }
        }`)

	var challenge controller.WebauthnChallenge
	if err := json.Unmarshal(rawChallenge, &challenge); err != nil {
		t.Fatal(err)
	}

	return resp, challenge
}

//nolint:dupl
func TestPostSignupWebauthnVerify(t *testing.T) { //nolint:maintidx
	t.Parallel()

	refreshTokenID := uuid.MustParse("c3b747ef-76a9-4c56-8091-ed3e6b8afb2c")
	userID := uuid.MustParse("cf91d1bc-875e-49bc-897f-fbccf32ede11")
	insertResponse := sql.InsertUserWithSecurityKeyAndRefreshTokenRow{
		UserID:         userID,
		RefreshTokenID: refreshTokenID,
	}

	touchIDRequest, touchIDWebauthnChallenge := webAuthnTouchID(t)

	windowsHelloRequest, windowsHelloWebauthnChallenge := webAuthnWindowsHello(t)

	cases := []testRequest[api.PostSignupWebauthnVerifyRequestObject, api.PostSignupWebauthnVerifyResponseObject]{
		{
			name:   "touchID - no email verify",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().InsertUserWithSecurityKeyAndRefreshToken(
					gomock.Any(),
					cmpDBParams(sql.InsertUserWithSecurityKeyAndRefreshTokenParams{
						ID:                    userID,
						Disabled:              false,
						DisplayName:           "Jane Doe",
						AvatarUrl:             "",
						Email:                 sql.Text("jane@acme.com"),
						Ticket:                pgtype.Text{}, //nolint:exhaustruct
						TicketExpiresAt:       sql.TimestampTz(time.Now()),
						EmailVerified:         false,
						Locale:                "en",
						DefaultRole:           "user",
						Metadata:              []byte("null"),
						Roles:                 []string{"user", "me"},
						RefreshTokenHash:      pgtype.Text{}, //nolint:exhaustruct
						RefreshTokenExpiresAt: sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
						CredentialID:          "LychOomEPgZu4XNwiDvzlP5hd1U",
						CredentialPublicKey: []uint8{
							0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20, 0x57, 0xe1, 0xb5, 0x82, 0xa0, 0x95, 0xc4, 0x1a, 0xf3, 0x65, 0x9d, 0xdd, 0xc2, 0x68, 0xcf, 0x66, 0x35, 0x25, 0x32, 0xa5, 0x86, 0x22, 0xfb, 0xf7, 0xc6, 0xc6, 0x08, 0x6d, 0xa9, 0xc9, 0x64, 0x7f, 0x22, 0x58, 0x20, 0xa3, 0x50, 0x94, 0x11, 0xb8, 0x27, 0x52, 0xae, 0x46, 0xec, 0x56, 0x3a, 0x3b, 0x3a, 0x6d, 0x71, 0x24, 0x10, 0x66, 0xae, 0xb2, 0x57, 0x75, 0xd5, 0xbb, 0x98, 0x8c, 0xd0, 0xc5, 0x91, 0x1f, 0x65, //nolint:lll
						},
						Nickname: pgtype.Text{}, //nolint:exhaustruct
					}),
				).Return(insertResponse, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
				mock := mock.NewMockHIBPClient(ctrl)
				return mock
			},
			customClaimer: nil,
			request: api.PostSignupWebauthnVerifyRequestObject{
				Body: &api.SignUpWebauthnVerifyRequest{
					Credential:           touchIDRequest,
					Options:              nil,
					AdditionalProperties: nil,
				},
			},
			expectedResponse: api.PostSignupWebauthnVerify200JSONResponse{
				Session: &api.Session{
					AccessToken:          "xxxxx",
					AccessTokenExpiresIn: 900,
					RefreshTokenId:       "c3b747ef-76a9-4c56-8091-ed3e6b8afb2c",
					RefreshToken:         "ff0499a1-7935-4052-baea-6c3a573b1b6a",
					User: &api.User{
						AvatarUrl:           "",
						CreatedAt:           time.Now(),
						DefaultRole:         "user",
						DisplayName:         "Jane Doe",
						Email:               ptr(types.Email("jane@acme.com")),
						EmailVerified:       false,
						Id:                  "cf91d1bc-875e-49bc-897f-fbccf32ede11",
						IsAnonymous:         false,
						Locale:              "en",
						Metadata:            nil,
						PhoneNumber:         "",
						PhoneNumberVerified: false,
						Roles:               []string{"user", "me"},
					},
				},
			},
			expectedJWT: &jwt.Token{
				Raw:    "",
				Method: jwt.SigningMethodHS256,
				Header: map[string]any{"alg": string("HS256"), "typ": string("JWT")},
				Claims: jwt.MapClaims{
					"exp": float64(time.Now().Add(900 * time.Second).Unix()),
					"https://hasura.io/jwt/claims": map[string]any{
						"x-hasura-allowed-roles": []any{"user", "me"},
						"x-hasura-default-role":  string("user"),
						"x-hasura-user-id": string(
							"cf91d1bc-875e-49bc-897f-fbccf32ede11",
						),
						"x-hasura-user-is-anonymous": string("false"),
					},
					"iat": float64(time.Now().Unix()),
					"iss": string("hasura-auth"),
					"sub": string("cf91d1bc-875e-49bc-897f-fbccf32ede11"),
				},
				Signature: []uint8{},
				Valid:     true,
			},
			jwtTokenFn: nil,
		},

		{
			name:   "windows hello - no email verify",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().InsertUserWithSecurityKeyAndRefreshToken(
					gomock.Any(),
					cmpDBParams(sql.InsertUserWithSecurityKeyAndRefreshTokenParams{
						ID:                    userID,
						Disabled:              false,
						DisplayName:           "Jane Doe",
						AvatarUrl:             "",
						Email:                 sql.Text("jane@acme.com"),
						Ticket:                pgtype.Text{}, //nolint:exhaustruct
						TicketExpiresAt:       sql.TimestampTz(time.Now()),
						EmailVerified:         false,
						Locale:                "en",
						DefaultRole:           "user",
						Metadata:              []byte("null"),
						Roles:                 []string{"user", "me"},
						RefreshTokenHash:      pgtype.Text{}, //nolint:exhaustruct
						RefreshTokenExpiresAt: sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
						CredentialID:          "t4r2_E24k3bp-LwQUz5M2xazSsWfZpATRPtaelkfqfc",
						CredentialPublicKey: []uint8{
							0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20, 0x9c, 0xe4, 0x9a, 0x64, 0x2b, 0xd7, 0xe6, 0x3b, 0xd9, 0xc2, 0x35, 0xdd, 0x6b, 0x61, 0x0e, 0xe3, 0x77, 0xb1, 0x8e, 0xae, 0x8e, 0xf5, 0x38, 0x09, 0x21, 0x68, 0xde, 0x06, 0xc4, 0xfd, 0x83, 0x75, 0x22, 0x58, 0x20, 0xb0, 0xfa, 0x39, 0x07, 0xea, 0x14, 0x3e, 0xe2, 0x1a, 0xd8, 0xa0, 0xaf, 0x79, 0xf8, 0x2c, 0x9b, 0x1c, 0xc3, 0x65, 0xd2, 0x43, 0x5a, 0x3a, 0x11, 0x0d, 0xad, 0xef, 0xf7, 0x39, 0x93, 0x9e, 0xb5, //nolint:lll
						},
						Nickname: pgtype.Text{}, //nolint:exhaustruct
					}),
				).Return(insertResponse, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
				mock := mock.NewMockHIBPClient(ctrl)
				return mock
			},
			customClaimer: nil,
			request: api.PostSignupWebauthnVerifyRequestObject{
				Body: &api.SignUpWebauthnVerifyRequest{
					Credential:           windowsHelloRequest,
					Options:              nil,
					AdditionalProperties: nil,
				},
			},
			expectedResponse: api.PostSignupWebauthnVerify200JSONResponse{
				Session: &api.Session{
					AccessToken:          "xxxxx",
					AccessTokenExpiresIn: 900,
					RefreshTokenId:       "c3b747ef-76a9-4c56-8091-ed3e6b8afb2c",
					RefreshToken:         "ff0499a1-7935-4052-baea-6c3a573b1b6a",
					User: &api.User{
						AvatarUrl:           "",
						CreatedAt:           time.Now(),
						DefaultRole:         "user",
						DisplayName:         "Jane Doe",
						Email:               ptr(types.Email("jane@acme.com")),
						EmailVerified:       false,
						Id:                  "cf91d1bc-875e-49bc-897f-fbccf32ede11",
						IsAnonymous:         false,
						Locale:              "en",
						Metadata:            nil,
						PhoneNumber:         "",
						PhoneNumberVerified: false,
						Roles:               []string{"user", "me"},
					},
				},
			},
			expectedJWT: &jwt.Token{
				Raw:    "",
				Method: jwt.SigningMethodHS256,
				Header: map[string]any{"alg": string("HS256"), "typ": string("JWT")},
				Claims: jwt.MapClaims{
					"exp": float64(time.Now().Add(900 * time.Second).Unix()),
					"https://hasura.io/jwt/claims": map[string]any{
						"x-hasura-allowed-roles": []any{"user", "me"},
						"x-hasura-default-role":  string("user"),
						"x-hasura-user-id": string(
							"cf91d1bc-875e-49bc-897f-fbccf32ede11",
						),
						"x-hasura-user-is-anonymous": string("false"),
					},
					"iat": float64(time.Now().Unix()),
					"iss": string("hasura-auth"),
					"sub": string("cf91d1bc-875e-49bc-897f-fbccf32ede11"),
				},
				Signature: []uint8{},
				Valid:     true,
			},
			jwtTokenFn: nil,
		},

		{
			name: "touchID - email verify",
			config: func() *controller.Config {
				c := getConfig()
				c.RequireEmailVerification = true
				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().InsertUserWithSecurityKey(
					gomock.Any(),
					cmpDBParams(sql.InsertUserWithSecurityKeyParams{
						ID:              userID,
						Disabled:        false,
						DisplayName:     "Jane Doe",
						AvatarUrl:       "",
						Email:           sql.Text("jane@acme.com"),
						Ticket:          sql.Text("verifyEmail:xxxx"),
						TicketExpiresAt: sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
						EmailVerified:   false,
						Locale:          "en",
						DefaultRole:     "user",
						Metadata:        []byte("null"),
						Roles:           []string{"user", "me"},
						CredentialID:    "LychOomEPgZu4XNwiDvzlP5hd1U",
						CredentialPublicKey: []uint8{
							0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20, 0x57, 0xe1, 0xb5, 0x82, 0xa0, 0x95, 0xc4, 0x1a, 0xf3, 0x65, 0x9d, 0xdd, 0xc2, 0x68, 0xcf, 0x66, 0x35, 0x25, 0x32, 0xa5, 0x86, 0x22, 0xfb, 0xf7, 0xc6, 0xc6, 0x08, 0x6d, 0xa9, 0xc9, 0x64, 0x7f, 0x22, 0x58, 0x20, 0xa3, 0x50, 0x94, 0x11, 0xb8, 0x27, 0x52, 0xae, 0x46, 0xec, 0x56, 0x3a, 0x3b, 0x3a, 0x6d, 0x71, 0x24, 0x10, 0x66, 0xae, 0xb2, 0x57, 0x75, 0xd5, 0xbb, 0x98, 0x8c, 0xd0, 0xc5, 0x91, 0x1f, 0x65, //nolint:lll
						},
						Nickname: pgtype.Text{}, //nolint:exhaustruct
					}),
				).Return(userID, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)

				mock.EXPECT().SendEmail(
					gomock.Any(),
					"jane@acme.com",
					"en",
					notifications.TemplateNameEmailVerify,
					testhelpers.GomockCmpOpts(
						notifications.TemplateData{
							Link:        "https://local.auth.nhost.run/verify?redirectTo=http%3A%2F%2Flocalhost%3A3000&ticket=verifyEmail%3Ac2ee89db-095c-4904-b796-f6a507ee1260&type=emailVerify", //nolint:lll
							DisplayName: "Jane Doe",
							Email:       "jane@acme.com",
							NewEmail:    "",
							Ticket:      "verifyEmail:c2ee89db-095c-4904-b796-f6a507ee1260",
							RedirectTo:  "http://localhost:3000",
							Locale:      "en",
							ServerURL:   "https://local.auth.nhost.run",
							ClientURL:   "http://localhost:3000",
						},
						testhelpers.FilterPathLast(
							[]string{".Ticket"}, cmp.Comparer(cmpTicket)),

						testhelpers.FilterPathLast(
							[]string{".Link"}, cmp.Comparer(cmpLink)),
					)).Return(nil)

				return mock
			},
			hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
				mock := mock.NewMockHIBPClient(ctrl)
				return mock
			},
			customClaimer: nil,
			request: api.PostSignupWebauthnVerifyRequestObject{
				Body: &api.SignUpWebauthnVerifyRequest{
					Credential:           touchIDRequest,
					Options:              nil,
					AdditionalProperties: nil,
				},
			},
			expectedResponse: api.PostSignupWebauthnVerify200JSONResponse{
				Session: nil,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{
			name: "webauthn disabled",
			config: func() *controller.Config {
				c := getConfig()
				c.WebauthnEnabled = false
				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)

				return mock
			},
			hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
				mock := mock.NewMockHIBPClient(ctrl)
				return mock
			},
			customClaimer: nil,
			request: api.PostSignupWebauthnVerifyRequestObject{
				Body: &api.SignUpWebauthnVerifyRequest{
					Credential:           touchIDRequest,
					Options:              nil,
					AdditionalProperties: nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-endpoint",
				Message: "This endpoint is disabled",
				Status:  409,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{
			name: "signed up users disabled",
			config: func() *controller.Config {
				c := getConfig()
				c.DisableNewUsers = true
				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().InsertUserWithSecurityKey(
					gomock.Any(),
					cmpDBParams(sql.InsertUserWithSecurityKeyParams{
						ID:              userID,
						Disabled:        true,
						DisplayName:     "Jane Doe",
						AvatarUrl:       "",
						Email:           sql.Text("jane@acme.com"),
						Ticket:          sql.Text("verifyEmail:xxxx"),
						TicketExpiresAt: sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
						EmailVerified:   false,
						Locale:          "en",
						DefaultRole:     "user",
						Metadata:        []byte("null"),
						Roles:           []string{"user", "me"},
						CredentialID:    "LychOomEPgZu4XNwiDvzlP5hd1U",
						CredentialPublicKey: []uint8{
							0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20, 0x57, 0xe1, 0xb5, 0x82, 0xa0, 0x95, 0xc4, 0x1a, 0xf3, 0x65, 0x9d, 0xdd, 0xc2, 0x68, 0xcf, 0x66, 0x35, 0x25, 0x32, 0xa5, 0x86, 0x22, 0xfb, 0xf7, 0xc6, 0xc6, 0x08, 0x6d, 0xa9, 0xc9, 0x64, 0x7f, 0x22, 0x58, 0x20, 0xa3, 0x50, 0x94, 0x11, 0xb8, 0x27, 0x52, 0xae, 0x46, 0xec, 0x56, 0x3a, 0x3b, 0x3a, 0x6d, 0x71, 0x24, 0x10, 0x66, 0xae, 0xb2, 0x57, 0x75, 0xd5, 0xbb, 0x98, 0x8c, 0xd0, 0xc5, 0x91, 0x1f, 0x65, //nolint:lll
						},
						Nickname: pgtype.Text{}, //nolint:exhaustruct
					}),
				).Return(userID, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)

				return mock
			},
			hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
				mock := mock.NewMockHIBPClient(ctrl)
				return mock
			},
			customClaimer: nil,
			request: api.PostSignupWebauthnVerifyRequestObject{
				Body: &api.SignUpWebauthnVerifyRequest{
					Credential:           touchIDRequest,
					Options:              nil,
					AdditionalProperties: nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-user",
				Message: "User is disabled",
				Status:  401,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{
			name: "disable sign ups",
			config: func() *controller.Config {
				c := getConfig()
				c.DisableSignup = true
				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)

				return mock
			},
			hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
				mock := mock.NewMockHIBPClient(ctrl)
				return mock
			},
			customClaimer: nil,
			request: api.PostSignupWebauthnVerifyRequestObject{
				Body: &api.SignUpWebauthnVerifyRequest{
					Credential:           touchIDRequest,
					Options:              nil,
					AdditionalProperties: nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "signup-disabled",
				Message: "Sign up is disabled.",
				Status:  403,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{
			name:   "user exists",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().InsertUserWithSecurityKeyAndRefreshToken(
					gomock.Any(),
					cmpDBParams(sql.InsertUserWithSecurityKeyAndRefreshTokenParams{
						ID:                    userID,
						Disabled:              false,
						DisplayName:           "Jane Doe",
						AvatarUrl:             "",
						Email:                 sql.Text("jane@acme.com"),
						Ticket:                pgtype.Text{}, //nolint:exhaustruct
						TicketExpiresAt:       sql.TimestampTz(time.Now()),
						EmailVerified:         false,
						Locale:                "en",
						DefaultRole:           "user",
						Metadata:              []byte("null"),
						Roles:                 []string{"user", "me"},
						RefreshTokenHash:      pgtype.Text{}, //nolint:exhaustruct
						RefreshTokenExpiresAt: sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
						CredentialID:          "LychOomEPgZu4XNwiDvzlP5hd1U",
						CredentialPublicKey: []uint8{
							0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20, 0x57, 0xe1, 0xb5, 0x82, 0xa0, 0x95, 0xc4, 0x1a, 0xf3, 0x65, 0x9d, 0xdd, 0xc2, 0x68, 0xcf, 0x66, 0x35, 0x25, 0x32, 0xa5, 0x86, 0x22, 0xfb, 0xf7, 0xc6, 0xc6, 0x08, 0x6d, 0xa9, 0xc9, 0x64, 0x7f, 0x22, 0x58, 0x20, 0xa3, 0x50, 0x94, 0x11, 0xb8, 0x27, 0x52, 0xae, 0x46, 0xec, 0x56, 0x3a, 0x3b, 0x3a, 0x6d, 0x71, 0x24, 0x10, 0x66, 0xae, 0xb2, 0x57, 0x75, 0xd5, 0xbb, 0x98, 0x8c, 0xd0, 0xc5, 0x91, 0x1f, 0x65, //nolint:lll
						},
						Nickname: pgtype.Text{}, //nolint:exhaustruct
					}),
				).Return(sql.InsertUserWithSecurityKeyAndRefreshTokenRow{}, //nolint:exhaustruct
					errors.New(`ERROR: duplicate key value violates unique constraint "users_email_key" (SQLSTATE 23505)`), //nolint:goerr113,lll
				)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
				mock := mock.NewMockHIBPClient(ctrl)
				return mock
			},
			customClaimer: nil,
			request: api.PostSignupWebauthnVerifyRequestObject{
				Body: &api.SignUpWebauthnVerifyRequest{
					Credential:           touchIDRequest,
					Options:              nil,
					AdditionalProperties: nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "email-already-in-use",
				Message: "Email already in use",
				Status:  409,
			},
			expectedJWT: &jwt.Token{
				Raw:    "",
				Method: jwt.SigningMethodHS256,
				Header: map[string]any{"alg": string("HS256"), "typ": string("JWT")},
				Claims: jwt.MapClaims{
					"exp": float64(time.Now().Add(900 * time.Second).Unix()),
					"https://hasura.io/jwt/claims": map[string]any{
						"x-hasura-allowed-roles": []any{"user", "me"},
						"x-hasura-default-role":  string("user"),
						"x-hasura-user-id": string(
							"cf91d1bc-875e-49bc-897f-fbccf32ede11",
						),
						"x-hasura-user-is-anonymous": string("false"),
					},
					"iat": float64(time.Now().Unix()),
					"iss": string("hasura-auth"),
					"sub": string("cf91d1bc-875e-49bc-897f-fbccf32ede11"),
				},
				Signature: []uint8{},
				Valid:     true,
			},
			jwtTokenFn: nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, jwtGetter := getController(t, ctrl, tc.config, tc.db, getControllerOpts{
				customClaimer: tc.customClaimer,
				emailer:       tc.emailer,
				hibp:          tc.hibp,
			})

			if !tc.config().WebauthnEnabled {
				return
			}

			c.Webauthn.Storage["zznztjvFVUM0E2p8ZV6shXEcw2f4tbz5RrfZWk4VPXI"] = touchIDWebauthnChallenge
			c.Webauthn.Storage["zv9lPTJpOlgxzlrKWl-tG7AdxeUIbCwxqV8MFZZNRdA"] = windowsHelloWebauthnChallenge

			resp := assertRequest(
				context.Background(),
				t,
				c.PostSignupWebauthnVerify,
				tc.request,
				tc.expectedResponse,
			)

			resp200, ok := resp.(api.PostSignupWebauthnVerify200JSONResponse)
			if ok {
				assertSession(t, jwtGetter, resp200.Session, tc.expectedJWT)

				if _, ok := c.Webauthn.Storage["zznztjvFVUM0E2p8ZV6shXEcw2f4tbz5RrfZWk4VPXI"]; ok {
					t.Errorf("challenge should've been removed")
				}
			}
		})
	}
}
