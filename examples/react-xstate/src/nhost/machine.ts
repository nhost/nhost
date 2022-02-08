import { createMachine } from 'xstate'
import { INITIAL_CONTEXT, NhostContext } from './context'

export type NhostMachine = typeof nhostMachine
export const nhostMachine =
  /** @xstate-layout N4IgpgJg5mDOIC5QDsAWB7WAXAdAQwFctUxksBLAYzwvWR1nKmUgHkicAzPcgG3ORQAxIlAAHTOVrJRIAB6IAjACZlADhwBWACwA2AJxrFAdl3a1ugAzKANCACeStQGZLOfZcvPliy9sWKakEAvsF2aJi4hMSkFNTSDEwsEOxYQgDKAJIA4gBymbkA+gAKAILp6QDqrABKACKyEozSsgoI+no42pregd6a+soGdo4I6v44avqGxi7W08qh4RjY+EQkZFQ05HSJzGxEGTn5RWUV1fUAMgCiFYXXALKlmZeNki1I8ogdil09Pi5lAMhvoRoggcZ9O5PJZFJpdLNjPCliAIqtohs4ttdox9ilDjVrtlMukACrXGpvZo7GSfNodXR-XqA4HDBzgnzGaGeBYzCzGFFoqLrWJbBK45KpESfJpSGmtJRIzSTJGWQzKYyqTxqMEIQIIrqeQLKfSBIwCsKolbCmKbeI0ta2rEUQQ4MR4WCwADu6AAThBeHBYNcALY8XhCCB0MA4AQAN3QAGsYxjRfEwMUPd6-QGg6Hw1S5XQFQgelyYSpnIoPKpnLpdT5LBoPNq68pPK4LctIo7MWKHam7dtXe7PT7-YHPfm+EIwL7fX63bwaJw-SHe2maBms+Pc1Ow3xCx9QG0yzgK8oqzXL-X2WNAuXdAZNGoBrCEYLrRuhwlB86BFAbo7jmkbRrGyAJsm37OmAACqsBzpUUioJmY45ke8p0ogZ4Xle1g3rq3jGNoODONMr5PpoijOMYXZWj2f79rsjH2iOwH+rO86LmIy5YKuvrrixW7wYhyGodm-oYcWWGljR55Gpe1b4XWDYmo+xjWNRlhUVM2ifgxIo-g6vpgFA5DYHOAGgSw4GQTGJlmRZvoib6Um0ie2FybhSm1reozONoHSkdM6pNoo2iXvp6KGf+uwOeZWCWYInELr6S4rmuODxU5LluSWOEKXhvmEc4agkWR0zVnWZhRTafb2jiSSQJk9CUKgeCCGA068LGuZCAAwgAEqUuTZNc9xPC8eUyRq3TnmRyjdFYOi6EEuqBDo8nWMRSJwiatXQUx9ASs1rXtZ13VZWAACOBBwC6whRjZ8ZJvZN13dguRgF63XTR5Yx6FC+imMYZG6N4VjA+tSlbT47Z1poli6IoB1CeKTUQC1OBtR1MCXSZt33VZc6pelfGZQTH1YF9P0Hrwf1fADBjuCDYMQ2qxjrUCJEVgElUBItqMxUdezJFjOMXXTXDhlZDNtItzPAwibNDBz62rRoiOwkYEXwtYQtOiLJ2Y2duPbmh-q9YGA3DaN41nFUtQNDK7yYf9GoBKRAyBQFrhWIohFeMqMJtq+Kh+JoBv1dix0Y+L50wOJu5XYT2BWU9MYvVBEuJ+xEBy+CSPKJM6iqEExgmPC2gNrRweeFRDemooH6WkKh0NbHeLx2bSc5inVPE1xaU8RlAnYwn5sSfnLvUtJ7vaBFpGl6oe3qPomgNtVW3N2ooNEboUebujXem51veW9wfCyzPRbuYzi2L94aiqD4mhl+vDb6KVWj12oTbLXRNuaMHTGxakcPIrBYKkgLnqIwbgYRqnXoicGoI7zhVcDgDSsJm7aA0kiTUh8jKNWYABKUGdbKvVFqQogMCCqwkUteFSaCgjNiNAvMqfR9CENip3ZA1C0gk24rxfi64JT8NoV5QqPkCJoPItydsSpVrI0jq3L8WBXrIBqGATgJlYAkDStgdAYgxCQGlOIV2c9GbVhfEyWsXgWEDF1HoXB3IkaaA0uFZEqiezqOTJo7Ruj9FWzAGYkAspjxWO0JYLku9EZlVmE+COTjzSGlhG-TspoD7eNWL40gWidFwCCSY5AEArJZAgVAmB1iNDdG8JeexQRHF3jfqDVxvhuhAmiQdXJ-iCl6LnG6UgpTkpVL0MXVaSIOgWBfH4aud5SpIlSUXCuiMH7dI0fkwJAzinDOEHIbAW58CcESmlXwngqmg3KtoUqNFrBmCGH5bCfR5HXLIlEnw6y-GbMKQMkyfTUDpzAlnN6-zSQaNGdElUcTcEWCsN0JxPhyrkV0EMRal5AFqI2QEn5aU-mBMHqTEe5Mx54sKWCvxVSkZAzKoFKYLgfac2aXCRkFV14rwrvtbJuAenfP6WlS+-ARk3wiW0cKkLYlNhhYk+Fd5rnwmCoYQY5hXwBRUd2HJWL-m-Oxf0iAoTwlu0ieK1U8TYVJOaW-KEUx9BmFhM4N+nL1W4BYF6XlqByWkGCUIWCxQ6ilHJIUQkAAxQk6RBqFFJKwAA0tcXIMD2zhRwAiYGzj7V1MeQgZGjIKy9EClRIYB0XVuo9fQOMeB+AQGHI9IFEFKFtyLTq91GicBlorVWhAL0O4AG1LAAF0qnVi5AvHQSM9rwlMLqHQ5YjQ2tBr4HQKMuU4AbaC5trbyCVoeilIRo91z1u+sWtd5aN3ts7THHt-bhWGtFYOro3QonKKBAiDNEVnDby-sRMZ1zC0HsbSWltx7N2mKqQYDQrhcEovMKDZ+k6LDb1Wva6YmpFhLpXYE-9Arr7mNnnfUVoHSJ+FMItXepVbDzI0tvRpfRNQqNbugCAcBZBAOFh3UWBxnXoGuEPeAV7LGiuwTgVQT4ES0RwT0Bs0SgaeFrJeeEJg9JLuAcQyUHB4yAd+rx3DShLxvpWoYEwZgLDWAbKtNw1qv7URUAEV83CjYY1SLZQD59p7YdviWQw2bcGeCsCaf2zgGzhVYd5yE-hZpqFs6x42Dm8Beh4A9AAapZTgR0YEMlsX0IEgw2SjGrBMFszdtLtm9mq+i0VDaRfsxwTDghUsuHPMDYiaSYQwbvAmtw+XTS7zgVkp17cY5sfxLgAVkAcDoBiK5TTJY4SLz07Me1ZUzDrV3sXfLJpm6uBcBF-rUWqvhhGywLA45ExVLfm4W1yG-6aHcSoCTvhuTVgfN1rbx8VNDb2xAHAYA5AJQArlSbMk4TVnPLMLU9dIQBXWj8e7y0isdBK8x8r23Ktvb4CNggyAMR+nIAAL0gCduESaokXe0tdsjOW-5vpbBzS7134dfiU7w9j0tUcubCRYrTepAq-HO2XEnHL1aQlcXCpE7YumKZY0jvEqRUsmHSyyLLqCcve1cWtgzUwUO9YZ31h6QELZ7mDHTSlZPwRwkpx2WiXgES1OewOCXOvRxTyN6pYG8ibVRKrAvDFBlEe-jtwBGBswJMmm5G-cGL4y50+99HBI2UTn+-++7RNemDDRKBAFOZ-lSqa0ohpKwVZwvi59yAuOp88ZSw3YGZdnHuPxshMqB8KLong2IlDNBsw67WFeR0WEpgbfKdOuPM2l0K8xmG6zg1fHwTEWDgtJa2k9BrTQZRWGSMkZ1gX33xnJtB+S3DMExzFaNOuZFYgVw1hJjP3XjRdetSM9KHXh39QNFfBGGfpvgb3dd98GCbXnw80lV6wrSL5K5-zbw7Sjpprv6gKl5dRSyUxEw1YJ73ySbBSviDCEagziZoI3iTDOD2pEa+YqA9alZ1RHzF4nw75l577VZQDxrthQgRSGBvIBSQzqweA-zWBqjaSeCmDEEI7R7kFiwwGXQxZxYASJa+jkDJYdzxqSqoHAgYFprqx-5azr7p7+AhCF4CH97b45ywEFhIHywk7yHoG4KYH+ZoIBDTraxIyzDTB6BQEl6UGTzJwj5V5capQ8bH7XpT6LLeARzuJXZqQZrjDZrSY-Dgx1KOEUF6HOb76wAECUCUBBi16eyIY+zXKr4Byta0TWELxw68EKaa5+46Gf65x6775j6pG-DpFfyZH+yfwE4wj5omBDC7x8H04lFb5lEuF9xuFqYVrObxrTCMjPxjGoot5+CETURhFeAVxwI+wdFR5kGlEwFxEj7xoTJewdB1F+ywgmaDBbTC6nZi7FFF6rHOFxHwFpyIHeGT5jDaQxLLzlyVyLatYBQaAuB1jeDAwmC95aErHdFrF5zM6Cq0GGEm5lQlx+C+C0RajZGjAmhRIcENxwhNz-FnHaFAmXF5yyF4ElzPzqC7yvF35jAajKhfH+CBSQa+BLFlZYkf53wT4c6i5WrPHElIhvGjDTBvoVivLmAopkTRF8KCDS4QljA9BJoVxIYLx1jNxAhLYGgdZ1EaH6wAlEJMns75SknoHbwvi6AjqTKfJ5KNoDKGLGJ47ikvz15E6r49DjoZqWq-DwjN6GZvw6DGm9JbJpQbHikqDERQpqjtiJJtHJJURaBPiEndCxKLq9Y8qmnDxDLx53Ec6VwxKGBURfxfxawbzNImifEhRPzaR4F0ncqarelXT-LJls44ZTZIwkSGD5F0oBQfoIpeCE7kQ34t4F5xnlk4qgnVnMlTaorbHdA9BUoDCMqjCykkRRKwgwi1I2qeluraparj5akA5qgsq7TWBTB9CklXZIwKpIh-wLDLkJmgkjZjb6IDqeyIzg5FbaQqDG6lickKqAiTIdAa4kE4Dxlar8rvbLpgCHZ+jHZ+ntLuA0qKr0qtnNLPzKgVQiZ6B6yxk-l-kVlVF+lNjtZQXNkMqTrgzFysrPxhS6znn-mUrImNm0pMH4XzJ-zFxzkAg8jVRe6rBoZkrNpuHIDV6eGyEUY0T3lVjtgWAHkuIVg-AmCDA9k-kcV6L-puFj6jbjayHIyCZeAPY7xNgvnX7bwe7zCFY-qup-pcW5iXkfYHZHayGbTJrERmBppCZOLmDwYahwrNzgxGWHp+KVHvZ4lnaQh2VyrpoNhXaUagyNnIxFGyW-qrreX9EQSAZ0GzBJqtH2U9AthTmIAGA8xGhr6mhXarSeUmVxW5hVLTD+UpppXBVt7wJGh6xRI7HrxFWxWerrqbqDkbn-R1FaBkTMrunEmknXJQjuWAhPiXgkXODNXoZHptqJTrm1kA4LzFw+C+BAhXauA3bNIoocHhSRGIz2lTWcXeU0Enbn5axcEMgBBXZOUaAVgoqmAwlPiTWoYxXTUUrimmhuDpV9VAgDW6gu4XgL6+xlRcJcowKuANg5V2rkRBAeBUShChBAA */
  createMachine<NhostContext>({
    context: INITIAL_CONTEXT,
    id: 'nhost',
    type: 'parallel',
    states: {
      authentication: {
        initial: 'signedOut',
        states: {
          signedOut: {
            initial: 'noErrors',
            states: {
              noErrors: {},
              invalidEmail: {},
              invalidPassword: {},
              awaitingVerification: {},
              failing: {
                always: [
                  {
                    cond: 'networkError',
                    target: '#nhost.authentication.signedOut.failed.network'
                  },
                  {
                    cond: 'existingUser',
                    target: '#nhost.authentication.signedOut.failed.existingUser'
                  },
                  {
                    cond: 'unverified',
                    target: '#nhost.authentication.signedOut.awaitingVerification'
                  },
                  {
                    cond: 'unauthorized',
                    target: '#nhost.authentication.signedOut.failed.unauthorized'
                  },
                  {
                    target: '#nhost.authentication.signedOut.failed.other'
                  }
                ]
              },
              failed: {
                exit: 'resetAuthenticationError',
                initial: 'other',
                states: {
                  other: {},
                  network: {},
                  existingUser: {},
                  unauthorized: {}
                }
              }
            },
            always: {
              cond: 'isUserSet',
              target: '#nhost.authentication.signedIn'
            },
            on: {
              SIGNIN_PASSWORD: [
                {
                  cond: 'invalidEmail',
                  target: '#nhost.authentication.signedOut.invalidEmail'
                },
                {
                  cond: 'invalidPassword',
                  target: '#nhost.authentication.signedOut.invalidPassword'
                },
                {
                  actions: ['saveEmail', 'savePassword'],
                  target: '#nhost.authentication.authenticating.password'
                }
              ],
              SIGNIN_PASSWORDLESS_EMAIL: [
                {
                  cond: 'invalidEmail',
                  target: '#nhost.authentication.signedOut.invalidEmail'
                },
                {
                  actions: 'saveEmail',
                  target: '#nhost.authentication.authenticating.passwordlessEmail'
                }
              ],
              REGISTER: [
                {
                  cond: 'invalidEmail',
                  target: '#nhost.authentication.signedOut.invalidEmail'
                },
                {
                  cond: 'invalidPassword',
                  target: '#nhost.authentication.signedOut.invalidPassword'
                },
                {
                  actions: ['saveEmail', 'savePassword'],
                  target: '#nhost.authentication.registering'
                }
              ]
            }
          },
          authenticating: {
            exit: 'clearForm',
            states: {
              passwordlessEmail: {
                invoke: {
                  src: 'signInPasswordlessEmail',
                  id: 'authenticatePasswordlessEmail',
                  onDone: [
                    {
                      target: '#nhost.authentication.signedOut.awaitingVerification'
                    }
                  ],
                  onError: [
                    {
                      actions: 'saveAuthenticationError',
                      target: '#nhost.authentication.signedOut.failing'
                    }
                  ]
                }
              },
              password: {
                invoke: {
                  src: 'signInPassword',
                  id: 'authenticateUserWithPassword',
                  onDone: [
                    {
                      actions: 'saveUser',
                      target: '#nhost.authentication.signedIn'
                    }
                  ],
                  onError: [
                    {
                      actions: 'saveAuthenticationError',
                      target: '#nhost.authentication.signedOut.failing'
                    }
                  ]
                }
              }
            }
          },
          registering: {
            exit: 'clearForm',
            invoke: {
              src: 'registerUser',
              id: 'registerUser',
              onDone: [
                {
                  actions: 'saveUser',
                  cond: 'hasUser',
                  target: '#nhost.authentication.signedIn'
                },
                {
                  target: '#nhost.authentication.authenticating.password'
                }
              ],
              onError: [
                {
                  actions: 'saveAuthenticationError',
                  target: '#nhost.authentication.signedOut.failing'
                }
              ]
            }
          },
          signedIn: {
            entry: 'persistRefreshToken',
            type: 'parallel',
            states: {
              changeEmail: {
                initial: 'idle',
                states: {
                  idle: {
                    initial: 'noErrors',
                    states: {
                      noErrors: {},
                      failed: {
                        exit: 'resetNewEmailError'
                      },
                      invalidEmail: {}
                    },
                    on: {
                      CHANGE_EMAIL: [
                        {
                          cond: 'invalidEmail',
                          target: '#nhost.authentication.signedIn.changeEmail.idle.invalidEmail'
                        },
                        {
                          actions: 'saveEmail',
                          target: '#nhost.authentication.signedIn.changeEmail.requesting'
                        }
                      ]
                    }
                  },
                  requesting: {
                    invoke: {
                      src: 'requestNewEmail',
                      id: 'requestNewEmail',
                      onDone: [
                        {
                          target: '#nhost.authentication.signedIn.changeEmail.awaitingVerification'
                        }
                      ],
                      onError: [
                        {
                          actions: 'saveNewEmailError',
                          target: '#nhost.authentication.signedIn.changeEmail.failing'
                        }
                      ]
                    }
                  },
                  failing: {
                    always: {
                      target: '#nhost.authentication.signedIn.changeEmail.idle.failed'
                    }
                  },
                  awaitingVerification: {}
                }
              },
              changePassword: {
                initial: 'idle',
                states: {
                  idle: {
                    initial: 'noErrors',
                    states: {
                      noErrors: {},
                      success: {},
                      failed: {
                        exit: 'resetNewPasswordError'
                      },
                      invalidPassword: {}
                    },
                    on: {
                      CHANGE_PASSWORD: [
                        {
                          cond: 'invalidPassword',
                          target:
                            '#nhost.authentication.signedIn.changePassword.idle.invalidPassword'
                        },
                        {
                          actions: 'savePassword',
                          target: '#nhost.authentication.signedIn.changePassword.requesting'
                        }
                      ]
                    }
                  },
                  requesting: {
                    invoke: {
                      src: 'changePassword',
                      id: 'changePassword',
                      onDone: [
                        {
                          target: '#nhost.authentication.signedIn.changePassword.idle.success'
                        }
                      ],
                      onError: [
                        {
                          actions: 'saveNewPasswordError',
                          target: '#nhost.authentication.signedIn.changePassword.failing'
                        }
                      ]
                    }
                  },
                  failing: {
                    always: {
                      target: '#nhost.authentication.signedIn.changePassword.idle.failed'
                    }
                  }
                }
              }
            },
            on: {
              SIGNOUT: {
                target: '#nhost.authentication.signingOut'
              }
            }
          },
          signingOut: {
            exit: 'persistRefreshToken',
            invoke: {
              src: 'signout',
              id: 'signingOut',
              onDone: [
                {
                  actions: 'resetSession',
                  target: '#nhost.authentication.signedOut'
                }
              ],
              onError: [
                {
                  actions: 'resetSession',
                  target: '#nhost.authentication.signedOut'
                }
              ]
            }
          }
        }
      },
      tokenRefresher: {
        initial: 'idle',
        states: {
          stopped: {
            always: {
              cond: 'shouldWaitForToken',
              target: '#nhost.tokenRefresher.idle'
            }
          },
          idle: {
            always: {
              cond: 'shouldStartTokenTimer',
              target: '#nhost.tokenRefresher.pending'
            }
          },
          pending: {
            after: {
              '1000': {
                actions: 'tickTokenRefresher',
                target: '#nhost.tokenRefresher.pending'
              }
            },
            always: {
              cond: 'shouldRefreshToken',
              target: '#nhost.tokenRefresher.refreshing'
            },
            on: {
              SIGNOUT: {
                actions: 'resetTokenRefresher',
                target: '#nhost.tokenRefresher.stopped'
              }
            }
          },
          refreshing: {
            invoke: {
              src: 'refreshToken',
              id: 'refreshToken',
              onDone: [
                {
                  actions: ['saveToken', 'resetTokenRefresher'],
                  target: '#nhost.tokenRefresher.refreshed'
                }
              ],
              onError: [
                {
                  actions: 'retryTokenRefresh',
                  cond: 'canRetryTokenRefresh',
                  target: '#nhost.tokenRefresher.pending'
                },
                {
                  actions: ['saveTokenTimerError', 'resetTokenRefresher'],
                  target: '#nhost.tokenRefresher.failing'
                }
              ]
            }
          },
          failing: {
            always: [
              {
                cond: 'tokenRefresherNetworkError',
                target: '#nhost.tokenRefresher.failed.network'
              },
              {
                target: '#nhost.tokenRefresher.failed'
              }
            ]
          },
          refreshed: {
            entry: 'persistRefreshToken',
            always: {
              target: '#nhost.tokenRefresher.pending'
            }
          },
          failed: {
            exit: 'resetTokenRefresherError',
            initial: 'other',
            states: {
              other: {},
              network: {}
            }
          }
        }
      },
      newRefreshToken: {
        initial: 'idle',
        states: {
          idle: {
            initial: 'noErrors',
            states: {
              noErrors: {},
              failed: {
                exit: 'resetNewTokenError',
                initial: 'other',
                states: {
                  other: {},
                  network: {}
                }
              },
              invalid: {}
            },
            on: {
              UPDATE_REFRESH_TOKEN: [
                {
                  cond: 'invalidRefreshToken',
                  target: '#nhost.newRefreshToken.idle.invalid'
                },
                {
                  target: '#nhost.newRefreshToken.validating'
                }
              ]
            }
          },
          validating: {
            invoke: {
              src: 'validateNewToken',
              onDone: [
                {
                  actions: ['saveToken', 'resetTokenRefresher'],
                  target: '#nhost.newRefreshToken.validated'
                }
              ],
              onError: [
                {
                  actions: 'saveNewTokenError',
                  target: '#nhost.newRefreshToken.failing'
                }
              ]
            }
          },
          validated: {
            exit: 'persistRefreshToken',
            always: {
              target: '#nhost.newRefreshToken.idle'
            }
          },
          failing: {
            always: [
              {
                cond: 'newTokenNetworkError',
                target: '#nhost.newRefreshToken.idle.failed.network'
              },
              {
                target: '#nhost.newRefreshToken.idle.failed'
              }
            ]
          }
        }
      }
    }
  })
