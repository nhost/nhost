import { ClassSignature } from '../types'

const mockClass: ClassSignature = {
  id: 701,
  name: 'AuthClient',
  kind: 128,
  kindString: 'Class',
  flags: {},
  children: [
    {
      id: 705,
      name: 'backendUrl',
      kind: 1024,
      kindString: 'Property',
      flags: {
        isReadonly: true
      },
      sources: [
        {
          fileName: 'core/src/client.ts',
          line: 11,
          character: 11
        }
      ],
      type: {
        type: 'intrinsic',
        name: 'string'
      }
    },
    {
      id: 706,
      name: 'clientUrl',
      kind: 1024,
      kindString: 'Property',
      flags: {
        isReadonly: true
      },
      sources: [
        {
          fileName: 'core/src/client.ts',
          line: 12,
          character: 11
        }
      ],
      type: {
        type: 'intrinsic',
        name: 'string'
      }
    },
    {
      id: 707,
      name: 'machine',
      kind: 1024,
      kindString: 'Property',
      flags: {
        isReadonly: true
      },
      sources: [
        {
          fileName: 'core/src/client.ts',
          line: 13,
          character: 11
        }
      ],
      type: {
        type: 'reference',
        typeArguments: [
          {
            type: 'reference',
            id: 1120,
            name: 'AuthContext'
          },
          {
            type: 'intrinsic',
            name: 'any'
          },
          {
            type: 'union',
            types: [
              {
                type: 'reflection',
                declaration: {
                  id: 708,
                  name: '__type',
                  kind: 65536,
                  kindString: 'Type literal',
                  flags: {},
                  children: [
                    {
                      id: 709,
                      name: 'type',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {},
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 4,
                          character: 6
                        }
                      ],
                      type: {
                        type: 'literal',
                        value: 'SESSION_UPDATE'
                      }
                    },
                    {
                      id: 710,
                      name: 'data',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {},
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 4,
                          character: 30
                        }
                      ],
                      type: {
                        type: 'reflection',
                        declaration: {
                          id: 711,
                          name: '__type',
                          kind: 65536,
                          kindString: 'Type literal',
                          flags: {},
                          children: [
                            {
                              id: 712,
                              name: 'session',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {},
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 4,
                                  character: 38
                                }
                              ],
                              type: {
                                type: 'reference',
                                id: 1454,
                                name: 'NhostSession'
                              }
                            }
                          ],
                          groups: [
                            {
                              title: 'Properties',
                              kind: 1024,
                              children: [712]
                            }
                          ]
                        }
                      }
                    }
                  ],
                  groups: [
                    {
                      title: 'Properties',
                      kind: 1024,
                      children: [709, 710]
                    }
                  ]
                }
              },
              {
                type: 'reflection',
                declaration: {
                  id: 713,
                  name: '__type',
                  kind: 65536,
                  kindString: 'Type literal',
                  flags: {},
                  children: [
                    {
                      id: 714,
                      name: 'type',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {},
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 5,
                          character: 6
                        }
                      ],
                      type: {
                        type: 'literal',
                        value: 'TRY_TOKEN'
                      }
                    },
                    {
                      id: 715,
                      name: 'token',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {},
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 5,
                          character: 25
                        }
                      ],
                      type: {
                        type: 'intrinsic',
                        name: 'string'
                      }
                    }
                  ],
                  groups: [
                    {
                      title: 'Properties',
                      kind: 1024,
                      children: [714, 715]
                    }
                  ]
                }
              },
              {
                type: 'reflection',
                declaration: {
                  id: 716,
                  name: '__type',
                  kind: 65536,
                  kindString: 'Type literal',
                  flags: {},
                  children: [
                    {
                      id: 717,
                      name: 'type',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {},
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 6,
                          character: 6
                        }
                      ],
                      type: {
                        type: 'literal',
                        value: 'SIGNIN_ANONYMOUS'
                      }
                    }
                  ],
                  groups: [
                    {
                      title: 'Properties',
                      kind: 1024,
                      children: [717]
                    }
                  ]
                }
              },
              {
                type: 'reflection',
                declaration: {
                  id: 718,
                  name: '__type',
                  kind: 65536,
                  kindString: 'Type literal',
                  flags: {},
                  children: [
                    {
                      id: 720,
                      name: 'signInMethod',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {},
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 9,
                          character: 6
                        }
                      ],
                      type: {
                        type: 'union',
                        types: [
                          {
                            type: 'literal',
                            value: 'email-password'
                          },
                          {
                            type: 'literal',
                            value: 'passwordless'
                          }
                        ]
                      }
                    },
                    {
                      id: 721,
                      name: 'connection',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {
                        isOptional: true
                      },
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 10,
                          character: 6
                        }
                      ],
                      type: {
                        type: 'union',
                        types: [
                          {
                            type: 'literal',
                            value: 'email'
                          },
                          {
                            type: 'literal',
                            value: 'sms'
                          }
                        ]
                      }
                    },
                    {
                      id: 722,
                      name: 'options',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {},
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 11,
                          character: 6
                        }
                      ],
                      type: {
                        type: 'reference',
                        id: 1433,
                        name: 'DeanonymizeOptions'
                      }
                    }
                  ],
                  groups: [
                    {
                      title: 'Properties',
                      kind: 1024,
                      children: [719, 720, 721, 722]
                    }
                  ]
                }
              },
              {
                type: 'reflection',
                declaration: {
                  id: 723,
                  name: '__type',
                  kind: 65536,
                  kindString: 'Type literal',
                  flags: {},
                  children: [
                    {
                      id: 724,
                      name: 'type',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {},
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 13,
                          character: 6
                        }
                      ],
                      type: {
                        type: 'literal',
                        value: 'SIGNIN_PASSWORD'
                      }
                    },
                    {
                      id: 725,
                      name: 'email',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {
                        isOptional: true
                      },
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 13,
                          character: 31
                        }
                      ],
                      type: {
                        type: 'intrinsic',
                        name: 'string'
                      }
                    },
                    {
                      id: 726,
                      name: 'password',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {
                        isOptional: true
                      },
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 13,
                          character: 47
                        }
                      ],
                      type: {
                        type: 'intrinsic',
                        name: 'string'
                      }
                    }
                  ],
                  groups: [
                    {
                      title: 'Properties',
                      kind: 1024,
                      children: [724, 725, 726]
                    }
                  ]
                }
              },
              {
                type: 'reflection',
                declaration: {
                  id: 727,
                  name: '__type',
                  kind: 65536,
                  kindString: 'Type literal',
                  flags: {},
                  children: [
                    {
                      id: 728,
                      name: 'type',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {},
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 15,
                          character: 6
                        }
                      ],
                      type: {
                        type: 'literal',
                        value: 'PASSWORDLESS_EMAIL'
                      }
                    },
                    {
                      id: 729,
                      name: 'email',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {
                        isOptional: true
                      },
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 16,
                          character: 6
                        }
                      ],
                      type: {
                        type: 'intrinsic',
                        name: 'string'
                      }
                    },
                    {
                      id: 730,
                      name: 'options',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {
                        isOptional: true
                      },
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 17,
                          character: 6
                        }
                      ],
                      type: {
                        type: 'reference',
                        id: 1428,
                        name: 'PasswordlessOptions'
                      }
                    }
                  ],
                  groups: [
                    {
                      title: 'Properties',
                      kind: 1024,
                      children: [728, 729, 730]
                    }
                  ]
                }
              },
              {
                type: 'reflection',
                declaration: {
                  id: 731,
                  name: '__type',
                  kind: 65536,
                  kindString: 'Type literal',
                  flags: {},
                  children: [
                    {
                      id: 732,
                      name: 'type',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {},
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 20,
                          character: 6
                        }
                      ],
                      type: {
                        type: 'literal',
                        value: 'PASSWORDLESS_SMS'
                      }
                    },
                    {
                      id: 733,
                      name: 'phoneNumber',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {
                        isOptional: true
                      },
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 21,
                          character: 6
                        }
                      ],
                      type: {
                        type: 'intrinsic',
                        name: 'string'
                      }
                    },
                    {
                      id: 734,
                      name: 'options',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {
                        isOptional: true
                      },
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 22,
                          character: 6
                        }
                      ],
                      type: {
                        type: 'reference',
                        id: 1428,
                        name: 'PasswordlessOptions'
                      }
                    }
                  ],
                  groups: [
                    {
                      title: 'Properties',
                      kind: 1024,
                      children: [732, 733, 734]
                    }
                  ]
                }
              },
              {
                type: 'reflection',
                declaration: {
                  id: 735,
                  name: '__type',
                  kind: 65536,
                  kindString: 'Type literal',
                  flags: {},
                  children: [
                    {
                      id: 736,
                      name: 'type',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {},
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 24,
                          character: 6
                        }
                      ],
                      type: {
                        type: 'literal',
                        value: 'PASSWORDLESS_SMS_OTP'
                      }
                    },
                    {
                      id: 737,
                      name: 'phoneNumber',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {
                        isOptional: true
                      },
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 24,
                          character: 43
                        }
                      ],
                      type: {
                        type: 'intrinsic',
                        name: 'string'
                      }
                    },
                    {
                      id: 738,
                      name: 'otp',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {
                        isOptional: true
                      },
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 24,
                          character: 65
                        }
                      ],
                      type: {
                        type: 'intrinsic',
                        name: 'string'
                      }
                    }
                  ],
                  groups: [
                    {
                      title: 'Properties',
                      kind: 1024,
                      children: [736, 737, 738]
                    }
                  ]
                }
              },
              {
                type: 'reflection',
                declaration: {
                  id: 739,
                  name: '__type',
                  kind: 65536,
                  kindString: 'Type literal',
                  flags: {},
                  children: [
                    {
                      id: 740,
                      name: 'type',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {},
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 25,
                          character: 6
                        }
                      ],
                      type: {
                        type: 'literal',
                        value: 'SIGNUP_EMAIL_PASSWORD'
                      }
                    },
                    {
                      id: 741,
                      name: 'email',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {
                        isOptional: true
                      },
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 25,
                          character: 37
                        }
                      ],
                      type: {
                        type: 'intrinsic',
                        name: 'string'
                      }
                    },
                    {
                      id: 742,
                      name: 'password',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {
                        isOptional: true
                      },
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 25,
                          character: 53
                        }
                      ],
                      type: {
                        type: 'intrinsic',
                        name: 'string'
                      }
                    },
                    {
                      id: 743,
                      name: 'options',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {
                        isOptional: true
                      },
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 25,
                          character: 72
                        }
                      ],
                      type: {
                        type: 'reference',
                        id: 1429,
                        name: 'SignUpOptions'
                      }
                    }
                  ],
                  groups: [
                    {
                      title: 'Properties',
                      kind: 1024,
                      children: [740, 741, 742, 743]
                    }
                  ]
                }
              },
              {
                type: 'reflection',
                declaration: {
                  id: 744,
                  name: '__type',
                  kind: 65536,
                  kindString: 'Type literal',
                  flags: {},
                  children: [
                    {
                      id: 745,
                      name: 'type',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {},
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 26,
                          character: 6
                        }
                      ],
                      type: {
                        type: 'literal',
                        value: 'SIGNOUT'
                      }
                    },
                    {
                      id: 746,
                      name: 'all',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {
                        isOptional: true
                      },
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 26,
                          character: 23
                        }
                      ],
                      type: {
                        type: 'intrinsic',
                        name: 'boolean'
                      }
                    }
                  ],
                  groups: [
                    {
                      title: 'Properties',
                      kind: 1024,
                      children: [745, 746]
                    }
                  ]
                }
              },
              {
                type: 'reflection',
                declaration: {
                  id: 747,
                  name: '__type',
                  kind: 65536,
                  kindString: 'Type literal',
                  flags: {},
                  children: [
                    {
                      id: 748,
                      name: 'type',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {},
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 27,
                          character: 6
                        }
                      ],
                      type: {
                        type: 'literal',
                        value: 'SIGNIN_MFA_TOTP'
                      }
                    },
                    {
                      id: 749,
                      name: 'ticket',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {
                        isOptional: true
                      },
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 27,
                          character: 31
                        }
                      ],
                      type: {
                        type: 'intrinsic',
                        name: 'string'
                      }
                    },
                    {
                      id: 750,
                      name: 'otp',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {
                        isOptional: true
                      },
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 27,
                          character: 48
                        }
                      ],
                      type: {
                        type: 'intrinsic',
                        name: 'string'
                      }
                    }
                  ],
                  groups: [
                    {
                      title: 'Properties',
                      kind: 1024,
                      children: [748, 749, 750]
                    }
                  ]
                }
              },
              {
                type: 'reflection',
                declaration: {
                  id: 751,
                  name: '__type',
                  kind: 65536,
                  kindString: 'Type literal',
                  flags: {},
                  children: [
                    {
                      id: 752,
                      name: 'type',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {},
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 28,
                          character: 6
                        }
                      ],
                      type: {
                        type: 'literal',
                        value: 'SIGNED_IN'
                      }
                    }
                  ],
                  groups: [
                    {
                      title: 'Properties',
                      kind: 1024,
                      children: [752]
                    }
                  ]
                }
              },
              {
                type: 'reflection',
                declaration: {
                  id: 753,
                  name: '__type',
                  kind: 65536,
                  kindString: 'Type literal',
                  flags: {},
                  children: [
                    {
                      id: 754,
                      name: 'type',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {},
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 29,
                          character: 6
                        }
                      ],
                      type: {
                        type: 'literal',
                        value: 'SIGNED_OUT'
                      }
                    }
                  ],
                  groups: [
                    {
                      title: 'Properties',
                      kind: 1024,
                      children: [754]
                    }
                  ]
                }
              },
              {
                type: 'reflection',
                declaration: {
                  id: 755,
                  name: '__type',
                  kind: 65536,
                  kindString: 'Type literal',
                  flags: {},
                  children: [
                    {
                      id: 756,
                      name: 'type',
                      kind: 1024,
                      kindString: 'Property',
                      flags: {},
                      sources: [
                        {
                          fileName: 'core/src/machines/events.ts',
                          line: 30,
                          character: 6
                        }
                      ],
                      type: {
                        type: 'literal',
                        value: 'TOKEN_CHANGED'
                      }
                    }
                  ],
                  groups: [
                    {
                      title: 'Properties',
                      kind: 1024,
                      children: [756]
                    }
                  ]
                }
              }
            ]
          },
          {
            type: 'reflection',
            declaration: {
              id: 757,
              name: '__type',
              kind: 65536,
              kindString: 'Type literal',
              flags: {}
            }
          },
          {
            type: 'reference',
            qualifiedName: 'BaseActionObject',
            package: '.pnpm',
            name: 'BaseActionObject'
          },
          {
            type: 'reference',
            qualifiedName: 'ServiceMap',
            package: '.pnpm',
            name: 'ServiceMap'
          },
          {
            type: 'intersection',
            types: [
              {
                type: 'reference',
                name: 'Typegen0'
              },
              {
                type: 'reflection',
                declaration: {
                  id: 758,
                  name: '__type',
                  kind: 65536,
                  kindString: 'Type literal',
                  flags: {}
                }
              }
            ]
          }
        ],
        qualifiedName: 'StateMachine',
        package: '.pnpm',
        name: 'StateMachine'
      }
    },
    {
      id: 702,
      name: 'constructor',
      kind: 512,
      kindString: 'Constructor',
      flags: {},
      sources: [
        {
          fileName: 'core/src/client.ts',
          line: 22,
          character: 2
        }
      ],
      signatures: [
        {
          id: 703,
          name: 'new AuthClient',
          kind: 16384,
          kindString: 'Constructor signature',
          flags: {},
          comment: {},
          parameters: [
            {
              id: 704,
              name: 'options',
              kind: 32768,
              kindString: 'Parameter',
              flags: {},
              comment: {
                shortText: 'Sample Description\n'
              },
              originalName: '__namedParameters',
              type: {
                type: 'reference',
                id: 698,
                name: 'NhostClientOptions'
              }
            }
          ],
          type: {
            type: 'reference',
            id: 701,
            name: 'AuthClient'
          }
        }
      ]
    },
    {
      id: 816,
      name: 'interpreter',
      kind: 262144,
      kindString: 'Accessor',
      flags: {},
      sources: [
        {
          fileName: 'core/src/client.ts',
          line: 61,
          character: 6
        }
      ],
      getSignature: [
        {
          id: 817,
          name: 'interpreter',
          kind: 524288,
          kindString: 'Get signature',
          flags: {},
          type: {
            type: 'union',
            types: [
              {
                type: 'intrinsic',
                name: 'undefined'
              },
              {
                type: 'reference',
                typeArguments: [
                  {
                    type: 'reference',
                    id: 1120,
                    name: 'AuthContext'
                  },
                  {
                    type: 'intrinsic',
                    name: 'any'
                  },
                  {
                    type: 'union',
                    types: [
                      {
                        type: 'reflection',
                        declaration: {
                          id: 818,
                          name: '__type',
                          kind: 65536,
                          kindString: 'Type literal',
                          flags: {},
                          children: [
                            {
                              id: 819,
                              name: 'type',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {},
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 4,
                                  character: 6
                                }
                              ],
                              type: {
                                type: 'literal',
                                value: 'SESSION_UPDATE'
                              }
                            },
                            {
                              id: 820,
                              name: 'data',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {},
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 4,
                                  character: 30
                                }
                              ],
                              type: {
                                type: 'reflection',
                                declaration: {
                                  id: 821,
                                  name: '__type',
                                  kind: 65536,
                                  kindString: 'Type literal',
                                  flags: {},
                                  children: [
                                    {
                                      id: 822,
                                      name: 'session',
                                      kind: 1024,
                                      kindString: 'Property',
                                      flags: {},
                                      sources: [
                                        {
                                          fileName: 'core/src/machines/events.ts',
                                          line: 4,
                                          character: 38
                                        }
                                      ],
                                      type: {
                                        type: 'reference',
                                        id: 1454,
                                        name: 'NhostSession'
                                      }
                                    }
                                  ],
                                  groups: [
                                    {
                                      title: 'Properties',
                                      kind: 1024,
                                      children: [822]
                                    }
                                  ]
                                }
                              }
                            }
                          ],
                          groups: [
                            {
                              title: 'Properties',
                              kind: 1024,
                              children: [819, 820]
                            }
                          ]
                        }
                      },
                      {
                        type: 'reflection',
                        declaration: {
                          id: 823,
                          name: '__type',
                          kind: 65536,
                          kindString: 'Type literal',
                          flags: {},
                          children: [
                            {
                              id: 824,
                              name: 'type',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {},
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 5,
                                  character: 6
                                }
                              ],
                              type: {
                                type: 'literal',
                                value: 'TRY_TOKEN'
                              }
                            },
                            {
                              id: 825,
                              name: 'token',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {},
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 5,
                                  character: 25
                                }
                              ],
                              type: {
                                type: 'intrinsic',
                                name: 'string'
                              }
                            }
                          ],
                          groups: [
                            {
                              title: 'Properties',
                              kind: 1024,
                              children: [824, 825]
                            }
                          ]
                        }
                      },
                      {
                        type: 'reflection',
                        declaration: {
                          id: 826,
                          name: '__type',
                          kind: 65536,
                          kindString: 'Type literal',
                          flags: {},
                          children: [
                            {
                              id: 827,
                              name: 'type',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {},
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 6,
                                  character: 6
                                }
                              ],
                              type: {
                                type: 'literal',
                                value: 'SIGNIN_ANONYMOUS'
                              }
                            }
                          ],
                          groups: [
                            {
                              title: 'Properties',
                              kind: 1024,
                              children: [827]
                            }
                          ]
                        }
                      },
                      {
                        type: 'reflection',
                        declaration: {
                          id: 828,
                          name: '__type',
                          kind: 65536,
                          kindString: 'Type literal',
                          flags: {},
                          children: [
                            {
                              id: 830,
                              name: 'signInMethod',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {},
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 9,
                                  character: 6
                                }
                              ],
                              type: {
                                type: 'union',
                                types: [
                                  {
                                    type: 'literal',
                                    value: 'email-password'
                                  },
                                  {
                                    type: 'literal',
                                    value: 'passwordless'
                                  }
                                ]
                              }
                            },
                            {
                              id: 831,
                              name: 'connection',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {
                                isOptional: true
                              },
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 10,
                                  character: 6
                                }
                              ],
                              type: {
                                type: 'union',
                                types: [
                                  {
                                    type: 'literal',
                                    value: 'email'
                                  },
                                  {
                                    type: 'literal',
                                    value: 'sms'
                                  }
                                ]
                              }
                            },
                            {
                              id: 832,
                              name: 'options',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {},
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 11,
                                  character: 6
                                }
                              ],
                              type: {
                                type: 'reference',
                                id: 1433,
                                name: 'DeanonymizeOptions'
                              }
                            }
                          ],
                          groups: [
                            {
                              title: 'Properties',
                              kind: 1024,
                              children: [829, 830, 831, 832]
                            }
                          ]
                        }
                      },
                      {
                        type: 'reflection',
                        declaration: {
                          id: 833,
                          name: '__type',
                          kind: 65536,
                          kindString: 'Type literal',
                          flags: {},
                          children: [
                            {
                              id: 834,
                              name: 'type',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {},
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 13,
                                  character: 6
                                }
                              ],
                              type: {
                                type: 'literal',
                                value: 'SIGNIN_PASSWORD'
                              }
                            },
                            {
                              id: 835,
                              name: 'email',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {
                                isOptional: true
                              },
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 13,
                                  character: 31
                                }
                              ],
                              type: {
                                type: 'intrinsic',
                                name: 'string'
                              }
                            },
                            {
                              id: 836,
                              name: 'password',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {
                                isOptional: true
                              },
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 13,
                                  character: 47
                                }
                              ],
                              type: {
                                type: 'intrinsic',
                                name: 'string'
                              }
                            }
                          ],
                          groups: [
                            {
                              title: 'Properties',
                              kind: 1024,
                              children: [834, 835, 836]
                            }
                          ]
                        }
                      },
                      {
                        type: 'reflection',
                        declaration: {
                          id: 837,
                          name: '__type',
                          kind: 65536,
                          kindString: 'Type literal',
                          flags: {},
                          children: [
                            {
                              id: 838,
                              name: 'type',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {},
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 15,
                                  character: 6
                                }
                              ],
                              type: {
                                type: 'literal',
                                value: 'PASSWORDLESS_EMAIL'
                              }
                            },
                            {
                              id: 839,
                              name: 'email',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {
                                isOptional: true
                              },
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 16,
                                  character: 6
                                }
                              ],
                              type: {
                                type: 'intrinsic',
                                name: 'string'
                              }
                            },
                            {
                              id: 840,
                              name: 'options',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {
                                isOptional: true
                              },
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 17,
                                  character: 6
                                }
                              ],
                              type: {
                                type: 'reference',
                                id: 1428,
                                name: 'PasswordlessOptions'
                              }
                            }
                          ],
                          groups: [
                            {
                              title: 'Properties',
                              kind: 1024,
                              children: [838, 839, 840]
                            }
                          ]
                        }
                      },
                      {
                        type: 'reflection',
                        declaration: {
                          id: 841,
                          name: '__type',
                          kind: 65536,
                          kindString: 'Type literal',
                          flags: {},
                          children: [
                            {
                              id: 842,
                              name: 'type',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {},
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 20,
                                  character: 6
                                }
                              ],
                              type: {
                                type: 'literal',
                                value: 'PASSWORDLESS_SMS'
                              }
                            },
                            {
                              id: 843,
                              name: 'phoneNumber',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {
                                isOptional: true
                              },
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 21,
                                  character: 6
                                }
                              ],
                              type: {
                                type: 'intrinsic',
                                name: 'string'
                              }
                            },
                            {
                              id: 844,
                              name: 'options',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {
                                isOptional: true
                              },
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 22,
                                  character: 6
                                }
                              ],
                              type: {
                                type: 'reference',
                                id: 1428,
                                name: 'PasswordlessOptions'
                              }
                            }
                          ],
                          groups: [
                            {
                              title: 'Properties',
                              kind: 1024,
                              children: [842, 843, 844]
                            }
                          ]
                        }
                      },
                      {
                        type: 'reflection',
                        declaration: {
                          id: 845,
                          name: '__type',
                          kind: 65536,
                          kindString: 'Type literal',
                          flags: {},
                          children: [
                            {
                              id: 846,
                              name: 'type',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {},
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 24,
                                  character: 6
                                }
                              ],
                              type: {
                                type: 'literal',
                                value: 'PASSWORDLESS_SMS_OTP'
                              }
                            },
                            {
                              id: 847,
                              name: 'phoneNumber',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {
                                isOptional: true
                              },
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 24,
                                  character: 43
                                }
                              ],
                              type: {
                                type: 'intrinsic',
                                name: 'string'
                              }
                            },
                            {
                              id: 848,
                              name: 'otp',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {
                                isOptional: true
                              },
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 24,
                                  character: 65
                                }
                              ],
                              type: {
                                type: 'intrinsic',
                                name: 'string'
                              }
                            }
                          ],
                          groups: [
                            {
                              title: 'Properties',
                              kind: 1024,
                              children: [846, 847, 848]
                            }
                          ]
                        }
                      },
                      {
                        type: 'reflection',
                        declaration: {
                          id: 849,
                          name: '__type',
                          kind: 65536,
                          kindString: 'Type literal',
                          flags: {},
                          children: [
                            {
                              id: 850,
                              name: 'type',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {},
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 25,
                                  character: 6
                                }
                              ],
                              type: {
                                type: 'literal',
                                value: 'SIGNUP_EMAIL_PASSWORD'
                              }
                            },
                            {
                              id: 851,
                              name: 'email',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {
                                isOptional: true
                              },
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 25,
                                  character: 37
                                }
                              ],
                              type: {
                                type: 'intrinsic',
                                name: 'string'
                              }
                            },
                            {
                              id: 852,
                              name: 'password',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {
                                isOptional: true
                              },
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 25,
                                  character: 53
                                }
                              ],
                              type: {
                                type: 'intrinsic',
                                name: 'string'
                              }
                            },
                            {
                              id: 853,
                              name: 'options',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {
                                isOptional: true
                              },
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 25,
                                  character: 72
                                }
                              ],
                              type: {
                                type: 'reference',
                                id: 1429,
                                name: 'SignUpOptions'
                              }
                            }
                          ],
                          groups: [
                            {
                              title: 'Properties',
                              kind: 1024,
                              children: [850, 851, 852, 853]
                            }
                          ]
                        }
                      },
                      {
                        type: 'reflection',
                        declaration: {
                          id: 854,
                          name: '__type',
                          kind: 65536,
                          kindString: 'Type literal',
                          flags: {},
                          children: [
                            {
                              id: 855,
                              name: 'type',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {},
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 26,
                                  character: 6
                                }
                              ],
                              type: {
                                type: 'literal',
                                value: 'SIGNOUT'
                              }
                            },
                            {
                              id: 856,
                              name: 'all',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {
                                isOptional: true
                              },
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 26,
                                  character: 23
                                }
                              ],
                              type: {
                                type: 'intrinsic',
                                name: 'boolean'
                              }
                            }
                          ],
                          groups: [
                            {
                              title: 'Properties',
                              kind: 1024,
                              children: [855, 856]
                            }
                          ]
                        }
                      },
                      {
                        type: 'reflection',
                        declaration: {
                          id: 857,
                          name: '__type',
                          kind: 65536,
                          kindString: 'Type literal',
                          flags: {},
                          children: [
                            {
                              id: 858,
                              name: 'type',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {},
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 27,
                                  character: 6
                                }
                              ],
                              type: {
                                type: 'literal',
                                value: 'SIGNIN_MFA_TOTP'
                              }
                            },
                            {
                              id: 859,
                              name: 'ticket',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {
                                isOptional: true
                              },
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 27,
                                  character: 31
                                }
                              ],
                              type: {
                                type: 'intrinsic',
                                name: 'string'
                              }
                            },
                            {
                              id: 860,
                              name: 'otp',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {
                                isOptional: true
                              },
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 27,
                                  character: 48
                                }
                              ],
                              type: {
                                type: 'intrinsic',
                                name: 'string'
                              }
                            }
                          ],
                          groups: [
                            {
                              title: 'Properties',
                              kind: 1024,
                              children: [858, 859, 860]
                            }
                          ]
                        }
                      },
                      {
                        type: 'reflection',
                        declaration: {
                          id: 861,
                          name: '__type',
                          kind: 65536,
                          kindString: 'Type literal',
                          flags: {},
                          children: [
                            {
                              id: 862,
                              name: 'type',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {},
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 28,
                                  character: 6
                                }
                              ],
                              type: {
                                type: 'literal',
                                value: 'SIGNED_IN'
                              }
                            }
                          ],
                          groups: [
                            {
                              title: 'Properties',
                              kind: 1024,
                              children: [862]
                            }
                          ]
                        }
                      },
                      {
                        type: 'reflection',
                        declaration: {
                          id: 863,
                          name: '__type',
                          kind: 65536,
                          kindString: 'Type literal',
                          flags: {},
                          children: [
                            {
                              id: 864,
                              name: 'type',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {},
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 29,
                                  character: 6
                                }
                              ],
                              type: {
                                type: 'literal',
                                value: 'SIGNED_OUT'
                              }
                            }
                          ],
                          groups: [
                            {
                              title: 'Properties',
                              kind: 1024,
                              children: [864]
                            }
                          ]
                        }
                      },
                      {
                        type: 'reflection',
                        declaration: {
                          id: 865,
                          name: '__type',
                          kind: 65536,
                          kindString: 'Type literal',
                          flags: {},
                          children: [
                            {
                              id: 866,
                              name: 'type',
                              kind: 1024,
                              kindString: 'Property',
                              flags: {},
                              sources: [
                                {
                                  fileName: 'core/src/machines/events.ts',
                                  line: 30,
                                  character: 6
                                }
                              ],
                              type: {
                                type: 'literal',
                                value: 'TOKEN_CHANGED'
                              }
                            }
                          ],
                          groups: [
                            {
                              title: 'Properties',
                              kind: 1024,
                              children: [866]
                            }
                          ]
                        }
                      }
                    ]
                  },
                  {
                    type: 'reflection',
                    declaration: {
                      id: 867,
                      name: '__type',
                      kind: 65536,
                      kindString: 'Type literal',
                      flags: {}
                    }
                  },
                  {
                    type: 'reference',
                    typeArguments: [
                      {
                        type: 'intersection',
                        types: [
                          {
                            type: 'reference',
                            name: 'Typegen0'
                          },
                          {
                            type: 'reflection',
                            declaration: {
                              id: 868,
                              name: '__type',
                              kind: 65536,
                              kindString: 'Type literal',
                              flags: {}
                            }
                          }
                        ]
                      }
                    ],
                    qualifiedName: 'MarkAllImplementationsAsProvided',
                    package: '.pnpm',
                    name: 'MarkAllImplementationsAsProvided'
                  }
                ],
                qualifiedName: 'Interpreter',
                package: '.pnpm',
                name: 'Interpreter'
              }
            ]
          }
        }
      ],
      setSignature: [
        {
          id: 869,
          name: 'interpreter',
          kind: 1048576,
          kindString: 'Set signature',
          flags: {},
          parameters: [
            {
              id: 870,
              name: 'interpreter',
              kind: 32768,
              kindString: 'Parameter',
              flags: {},
              type: {
                type: 'union',
                types: [
                  {
                    type: 'intrinsic',
                    name: 'undefined'
                  },
                  {
                    type: 'reference',
                    typeArguments: [
                      {
                        type: 'reference',
                        id: 1120,
                        name: 'AuthContext'
                      },
                      {
                        type: 'intrinsic',
                        name: 'any'
                      },
                      {
                        type: 'union',
                        types: [
                          {
                            type: 'reflection',
                            declaration: {
                              id: 871,
                              name: '__type',
                              kind: 65536,
                              kindString: 'Type literal',
                              flags: {},
                              children: [
                                {
                                  id: 872,
                                  name: 'type',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {},
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 4,
                                      character: 6
                                    }
                                  ],
                                  type: {
                                    type: 'literal',
                                    value: 'SESSION_UPDATE'
                                  }
                                },
                                {
                                  id: 873,
                                  name: 'data',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {},
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 4,
                                      character: 30
                                    }
                                  ],
                                  type: {
                                    type: 'reflection',
                                    declaration: {
                                      id: 874,
                                      name: '__type',
                                      kind: 65536,
                                      kindString: 'Type literal',
                                      flags: {},
                                      children: [
                                        {
                                          id: 875,
                                          name: 'session',
                                          kind: 1024,
                                          kindString: 'Property',
                                          flags: {},
                                          sources: [
                                            {
                                              fileName: 'core/src/machines/events.ts',
                                              line: 4,
                                              character: 38
                                            }
                                          ],
                                          type: {
                                            type: 'reference',
                                            id: 1454,
                                            name: 'NhostSession'
                                          }
                                        }
                                      ],
                                      groups: [
                                        {
                                          title: 'Properties',
                                          kind: 1024,
                                          children: [875]
                                        }
                                      ]
                                    }
                                  }
                                }
                              ],
                              groups: [
                                {
                                  title: 'Properties',
                                  kind: 1024,
                                  children: [872, 873]
                                }
                              ]
                            }
                          },
                          {
                            type: 'reflection',
                            declaration: {
                              id: 876,
                              name: '__type',
                              kind: 65536,
                              kindString: 'Type literal',
                              flags: {},
                              children: [
                                {
                                  id: 877,
                                  name: 'type',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {},
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 5,
                                      character: 6
                                    }
                                  ],
                                  type: {
                                    type: 'literal',
                                    value: 'TRY_TOKEN'
                                  }
                                },
                                {
                                  id: 878,
                                  name: 'token',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {},
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 5,
                                      character: 25
                                    }
                                  ],
                                  type: {
                                    type: 'intrinsic',
                                    name: 'string'
                                  }
                                }
                              ],
                              groups: [
                                {
                                  title: 'Properties',
                                  kind: 1024,
                                  children: [877, 878]
                                }
                              ]
                            }
                          },
                          {
                            type: 'reflection',
                            declaration: {
                              id: 879,
                              name: '__type',
                              kind: 65536,
                              kindString: 'Type literal',
                              flags: {},
                              children: [
                                {
                                  id: 880,
                                  name: 'type',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {},
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 6,
                                      character: 6
                                    }
                                  ],
                                  type: {
                                    type: 'literal',
                                    value: 'SIGNIN_ANONYMOUS'
                                  }
                                }
                              ],
                              groups: [
                                {
                                  title: 'Properties',
                                  kind: 1024,
                                  children: [880]
                                }
                              ]
                            }
                          },
                          {
                            type: 'reflection',
                            declaration: {
                              id: 881,
                              name: '__type',
                              kind: 65536,
                              kindString: 'Type literal',
                              flags: {},
                              children: [
                                {
                                  id: 883,
                                  name: 'signInMethod',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {},
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 9,
                                      character: 6
                                    }
                                  ],
                                  type: {
                                    type: 'union',
                                    types: [
                                      {
                                        type: 'literal',
                                        value: 'email-password'
                                      },
                                      {
                                        type: 'literal',
                                        value: 'passwordless'
                                      }
                                    ]
                                  }
                                },
                                {
                                  id: 884,
                                  name: 'connection',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {
                                    isOptional: true
                                  },
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 10,
                                      character: 6
                                    }
                                  ],
                                  type: {
                                    type: 'union',
                                    types: [
                                      {
                                        type: 'literal',
                                        value: 'email'
                                      },
                                      {
                                        type: 'literal',
                                        value: 'sms'
                                      }
                                    ]
                                  }
                                },
                                {
                                  id: 885,
                                  name: 'options',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {},
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 11,
                                      character: 6
                                    }
                                  ],
                                  type: {
                                    type: 'reference',
                                    id: 1433,
                                    name: 'DeanonymizeOptions'
                                  }
                                }
                              ],
                              groups: [
                                {
                                  title: 'Properties',
                                  kind: 1024,
                                  children: [882, 883, 884, 885]
                                }
                              ]
                            }
                          },
                          {
                            type: 'reflection',
                            declaration: {
                              id: 886,
                              name: '__type',
                              kind: 65536,
                              kindString: 'Type literal',
                              flags: {},
                              children: [
                                {
                                  id: 887,
                                  name: 'type',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {},
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 13,
                                      character: 6
                                    }
                                  ],
                                  type: {
                                    type: 'literal',
                                    value: 'SIGNIN_PASSWORD'
                                  }
                                },
                                {
                                  id: 888,
                                  name: 'email',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {
                                    isOptional: true
                                  },
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 13,
                                      character: 31
                                    }
                                  ],
                                  type: {
                                    type: 'intrinsic',
                                    name: 'string'
                                  }
                                },
                                {
                                  id: 889,
                                  name: 'password',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {
                                    isOptional: true
                                  },
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 13,
                                      character: 47
                                    }
                                  ],
                                  type: {
                                    type: 'intrinsic',
                                    name: 'string'
                                  }
                                }
                              ],
                              groups: [
                                {
                                  title: 'Properties',
                                  kind: 1024,
                                  children: [887, 888, 889]
                                }
                              ]
                            }
                          },
                          {
                            type: 'reflection',
                            declaration: {
                              id: 890,
                              name: '__type',
                              kind: 65536,
                              kindString: 'Type literal',
                              flags: {},
                              children: [
                                {
                                  id: 891,
                                  name: 'type',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {},
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 15,
                                      character: 6
                                    }
                                  ],
                                  type: {
                                    type: 'literal',
                                    value: 'PASSWORDLESS_EMAIL'
                                  }
                                },
                                {
                                  id: 892,
                                  name: 'email',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {
                                    isOptional: true
                                  },
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 16,
                                      character: 6
                                    }
                                  ],
                                  type: {
                                    type: 'intrinsic',
                                    name: 'string'
                                  }
                                },
                                {
                                  id: 893,
                                  name: 'options',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {
                                    isOptional: true
                                  },
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 17,
                                      character: 6
                                    }
                                  ],
                                  type: {
                                    type: 'reference',
                                    id: 1428,
                                    name: 'PasswordlessOptions'
                                  }
                                }
                              ],
                              groups: [
                                {
                                  title: 'Properties',
                                  kind: 1024,
                                  children: [891, 892, 893]
                                }
                              ]
                            }
                          },
                          {
                            type: 'reflection',
                            declaration: {
                              id: 894,
                              name: '__type',
                              kind: 65536,
                              kindString: 'Type literal',
                              flags: {},
                              children: [
                                {
                                  id: 895,
                                  name: 'type',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {},
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 20,
                                      character: 6
                                    }
                                  ],
                                  type: {
                                    type: 'literal',
                                    value: 'PASSWORDLESS_SMS'
                                  }
                                },
                                {
                                  id: 896,
                                  name: 'phoneNumber',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {
                                    isOptional: true
                                  },
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 21,
                                      character: 6
                                    }
                                  ],
                                  type: {
                                    type: 'intrinsic',
                                    name: 'string'
                                  }
                                },
                                {
                                  id: 897,
                                  name: 'options',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {
                                    isOptional: true
                                  },
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 22,
                                      character: 6
                                    }
                                  ],
                                  type: {
                                    type: 'reference',
                                    id: 1428,
                                    name: 'PasswordlessOptions'
                                  }
                                }
                              ],
                              groups: [
                                {
                                  title: 'Properties',
                                  kind: 1024,
                                  children: [895, 896, 897]
                                }
                              ]
                            }
                          },
                          {
                            type: 'reflection',
                            declaration: {
                              id: 898,
                              name: '__type',
                              kind: 65536,
                              kindString: 'Type literal',
                              flags: {},
                              children: [
                                {
                                  id: 899,
                                  name: 'type',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {},
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 24,
                                      character: 6
                                    }
                                  ],
                                  type: {
                                    type: 'literal',
                                    value: 'PASSWORDLESS_SMS_OTP'
                                  }
                                },
                                {
                                  id: 900,
                                  name: 'phoneNumber',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {
                                    isOptional: true
                                  },
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 24,
                                      character: 43
                                    }
                                  ],
                                  type: {
                                    type: 'intrinsic',
                                    name: 'string'
                                  }
                                },
                                {
                                  id: 901,
                                  name: 'otp',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {
                                    isOptional: true
                                  },
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 24,
                                      character: 65
                                    }
                                  ],
                                  type: {
                                    type: 'intrinsic',
                                    name: 'string'
                                  }
                                }
                              ],
                              groups: [
                                {
                                  title: 'Properties',
                                  kind: 1024,
                                  children: [899, 900, 901]
                                }
                              ]
                            }
                          },
                          {
                            type: 'reflection',
                            declaration: {
                              id: 902,
                              name: '__type',
                              kind: 65536,
                              kindString: 'Type literal',
                              flags: {},
                              children: [
                                {
                                  id: 903,
                                  name: 'type',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {},
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 25,
                                      character: 6
                                    }
                                  ],
                                  type: {
                                    type: 'literal',
                                    value: 'SIGNUP_EMAIL_PASSWORD'
                                  }
                                },
                                {
                                  id: 904,
                                  name: 'email',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {
                                    isOptional: true
                                  },
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 25,
                                      character: 37
                                    }
                                  ],
                                  type: {
                                    type: 'intrinsic',
                                    name: 'string'
                                  }
                                },
                                {
                                  id: 905,
                                  name: 'password',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {
                                    isOptional: true
                                  },
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 25,
                                      character: 53
                                    }
                                  ],
                                  type: {
                                    type: 'intrinsic',
                                    name: 'string'
                                  }
                                },
                                {
                                  id: 906,
                                  name: 'options',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {
                                    isOptional: true
                                  },
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 25,
                                      character: 72
                                    }
                                  ],
                                  type: {
                                    type: 'reference',
                                    id: 1429,
                                    name: 'SignUpOptions'
                                  }
                                }
                              ],
                              groups: [
                                {
                                  title: 'Properties',
                                  kind: 1024,
                                  children: [903, 904, 905, 906]
                                }
                              ]
                            }
                          },
                          {
                            type: 'reflection',
                            declaration: {
                              id: 907,
                              name: '__type',
                              kind: 65536,
                              kindString: 'Type literal',
                              flags: {},
                              children: [
                                {
                                  id: 908,
                                  name: 'type',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {},
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 26,
                                      character: 6
                                    }
                                  ],
                                  type: {
                                    type: 'literal',
                                    value: 'SIGNOUT'
                                  }
                                },
                                {
                                  id: 909,
                                  name: 'all',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {
                                    isOptional: true
                                  },
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 26,
                                      character: 23
                                    }
                                  ],
                                  type: {
                                    type: 'intrinsic',
                                    name: 'boolean'
                                  }
                                }
                              ],
                              groups: [
                                {
                                  title: 'Properties',
                                  kind: 1024,
                                  children: [908, 909]
                                }
                              ]
                            }
                          },
                          {
                            type: 'reflection',
                            declaration: {
                              id: 910,
                              name: '__type',
                              kind: 65536,
                              kindString: 'Type literal',
                              flags: {},
                              children: [
                                {
                                  id: 911,
                                  name: 'type',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {},
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 27,
                                      character: 6
                                    }
                                  ],
                                  type: {
                                    type: 'literal',
                                    value: 'SIGNIN_MFA_TOTP'
                                  }
                                },
                                {
                                  id: 912,
                                  name: 'ticket',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {
                                    isOptional: true
                                  },
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 27,
                                      character: 31
                                    }
                                  ],
                                  type: {
                                    type: 'intrinsic',
                                    name: 'string'
                                  }
                                },
                                {
                                  id: 913,
                                  name: 'otp',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {
                                    isOptional: true
                                  },
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 27,
                                      character: 48
                                    }
                                  ],
                                  type: {
                                    type: 'intrinsic',
                                    name: 'string'
                                  }
                                }
                              ],
                              groups: [
                                {
                                  title: 'Properties',
                                  kind: 1024,
                                  children: [911, 912, 913]
                                }
                              ]
                            }
                          },
                          {
                            type: 'reflection',
                            declaration: {
                              id: 914,
                              name: '__type',
                              kind: 65536,
                              kindString: 'Type literal',
                              flags: {},
                              children: [
                                {
                                  id: 915,
                                  name: 'type',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {},
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 28,
                                      character: 6
                                    }
                                  ],
                                  type: {
                                    type: 'literal',
                                    value: 'SIGNED_IN'
                                  }
                                }
                              ],
                              groups: [
                                {
                                  title: 'Properties',
                                  kind: 1024,
                                  children: [915]
                                }
                              ]
                            }
                          },
                          {
                            type: 'reflection',
                            declaration: {
                              id: 916,
                              name: '__type',
                              kind: 65536,
                              kindString: 'Type literal',
                              flags: {},
                              children: [
                                {
                                  id: 917,
                                  name: 'type',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {},
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 29,
                                      character: 6
                                    }
                                  ],
                                  type: {
                                    type: 'literal',
                                    value: 'SIGNED_OUT'
                                  }
                                }
                              ],
                              groups: [
                                {
                                  title: 'Properties',
                                  kind: 1024,
                                  children: [917]
                                }
                              ]
                            }
                          },
                          {
                            type: 'reflection',
                            declaration: {
                              id: 918,
                              name: '__type',
                              kind: 65536,
                              kindString: 'Type literal',
                              flags: {},
                              children: [
                                {
                                  id: 919,
                                  name: 'type',
                                  kind: 1024,
                                  kindString: 'Property',
                                  flags: {},
                                  sources: [
                                    {
                                      fileName: 'core/src/machines/events.ts',
                                      line: 30,
                                      character: 6
                                    }
                                  ],
                                  type: {
                                    type: 'literal',
                                    value: 'TOKEN_CHANGED'
                                  }
                                }
                              ],
                              groups: [
                                {
                                  title: 'Properties',
                                  kind: 1024,
                                  children: [919]
                                }
                              ]
                            }
                          }
                        ]
                      },
                      {
                        type: 'reflection',
                        declaration: {
                          id: 920,
                          name: '__type',
                          kind: 65536,
                          kindString: 'Type literal',
                          flags: {}
                        }
                      },
                      {
                        type: 'reference',
                        typeArguments: [
                          {
                            type: 'intersection',
                            types: [
                              {
                                type: 'reference',
                                name: 'Typegen0'
                              },
                              {
                                type: 'reflection',
                                declaration: {
                                  id: 921,
                                  name: '__type',
                                  kind: 65536,
                                  kindString: 'Type literal',
                                  flags: {}
                                }
                              }
                            ]
                          }
                        ],
                        qualifiedName: 'MarkAllImplementationsAsProvided',
                        package: '.pnpm',
                        name: 'MarkAllImplementationsAsProvided'
                      }
                    ],
                    qualifiedName: 'Interpreter',
                    package: '.pnpm',
                    name: 'Interpreter'
                  }
                ]
              }
            }
          ],
          type: {
            type: 'intrinsic',
            name: 'void'
          }
        }
      ]
    },
    {
      id: 922,
      name: 'onStart',
      kind: 2048,
      kindString: 'Method',
      flags: {},
      sources: [
        {
          fileName: 'core/src/client.ts',
          line: 71,
          character: 2
        }
      ],
      signatures: [
        {
          id: 923,
          name: 'onStart',
          kind: 4096,
          kindString: 'Call signature',
          flags: {},
          parameters: [
            {
              id: 924,
              name: 'fn',
              kind: 32768,
              kindString: 'Parameter',
              flags: {},
              type: {
                type: 'reflection',
                declaration: {
                  id: 925,
                  name: '__type',
                  kind: 65536,
                  kindString: 'Type literal',
                  flags: {},
                  signatures: [
                    {
                      id: 926,
                      name: '__type',
                      kind: 4096,
                      kindString: 'Call signature',
                      flags: {},
                      parameters: [
                        {
                          id: 927,
                          name: 'client',
                          kind: 32768,
                          kindString: 'Parameter',
                          flags: {},
                          type: {
                            type: 'reference',
                            id: 701,
                            name: 'AuthClient'
                          }
                        }
                      ],
                      type: {
                        type: 'intrinsic',
                        name: 'void'
                      }
                    }
                  ]
                }
              }
            }
          ],
          type: {
            type: 'intrinsic',
            name: 'void'
          }
        }
      ]
    }
  ],
  groups: [
    {
      title: 'Properties',
      kind: 1024,
      children: [705, 706, 707]
    },
    {
      title: 'Constructors',
      kind: 512,
      children: [702]
    },
    {
      title: 'Accessors',
      kind: 262144,
      children: [816]
    },
    {
      title: 'Methods',
      kind: 2048,
      children: [922]
    }
  ],
  sources: [
    {
      fileName: 'core/src/client.ts',
      line: 10,
      character: 13
    }
  ],
  extendedBy: [
    {
      type: 'reference',
      id: 928,
      name: 'AuthCookieClient'
    }
  ]
}

export default mockClass
