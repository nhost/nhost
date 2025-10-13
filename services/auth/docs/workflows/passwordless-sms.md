# Passwordless with SMS

```mermaid
sequenceDiagram
	autonumber
	actor U as User
	participant A as Hasura Auth
	participant S as SMS service
	U->>+A: HTTP POST /signin/passwordless/sms
	Note right of U: Phone number
	opt No user found
		A->>A: Create user
	end
	A-)+S: Send OTP code by SMS
	A->>-U: HTTP OK response (no data)
	S-)-U: Receive OTP code by SMS
	U->>+A: HTTP POST /signin/passwordless/sms/otp
	Note right of U: Phone number and OTP code
	A->>-U: HTTP OK response
	Note left of A: Refresh token + access token
```

## Test phone numbers

Environmental variable `AUTH_SMS_TEST_PHONE_NUMBERS` can be set with a comma separated test phone numbers. When sign in
is invoked the the SMS message with the verification code will be available in the logs. This way you can also test your SMS templates.