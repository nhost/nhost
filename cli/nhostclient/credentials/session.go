package credentials

type Session struct {
	Session struct {
		AccessToken          string `json:"accessToken"`
		AccessTokenExpiresIn int    `json:"accessTokenExpiresIn"`
		RefreshToken         string `json:"refreshToken"`
	} `json:"session"`
}
