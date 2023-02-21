export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  _Any: any;
};

export type Continent = {
  __typename?: 'Continent';
  code: Scalars['ID'];
  countries: Array<Country>;
  name: Scalars['String'];
};

export type ContinentFilterInput = {
  code?: InputMaybe<StringQueryOperatorInput>;
};

export type Country = {
  __typename?: 'Country';
  capital?: Maybe<Scalars['String']>;
  code: Scalars['ID'];
  continent: Continent;
  currency?: Maybe<Scalars['String']>;
  emoji: Scalars['String'];
  emojiU: Scalars['String'];
  languages: Array<Language>;
  name: Scalars['String'];
  native: Scalars['String'];
  phone: Scalars['String'];
  states: Array<State>;
};

export type CountryFilterInput = {
  code?: InputMaybe<StringQueryOperatorInput>;
  continent?: InputMaybe<StringQueryOperatorInput>;
  currency?: InputMaybe<StringQueryOperatorInput>;
};

export type Language = {
  __typename?: 'Language';
  code: Scalars['ID'];
  name?: Maybe<Scalars['String']>;
  native?: Maybe<Scalars['String']>;
  rtl: Scalars['Boolean'];
};

export type LanguageFilterInput = {
  code?: InputMaybe<StringQueryOperatorInput>;
};

export type Query = {
  __typename?: 'Query';
  _entities: Array<Maybe<_Entity>>;
  _service: _Service;
  continent?: Maybe<Continent>;
  continents: Array<Continent>;
  countries: Array<Country>;
  country?: Maybe<Country>;
  language?: Maybe<Language>;
  languages: Array<Language>;
};


export type Query__EntitiesArgs = {
  representations: Array<Scalars['_Any']>;
};


export type Query_ContinentArgs = {
  code: Scalars['ID'];
};


export type Query_ContinentsArgs = {
  filter?: InputMaybe<ContinentFilterInput>;
};


export type Query_CountriesArgs = {
  filter?: InputMaybe<CountryFilterInput>;
};


export type Query_CountryArgs = {
  code: Scalars['ID'];
};


export type Query_LanguageArgs = {
  code: Scalars['ID'];
};


export type Query_LanguagesArgs = {
  filter?: InputMaybe<LanguageFilterInput>;
};

export type State = {
  __typename?: 'State';
  code?: Maybe<Scalars['String']>;
  country: Country;
  name: Scalars['String'];
};

export type StringQueryOperatorInput = {
  eq?: InputMaybe<Scalars['String']>;
  glob?: InputMaybe<Scalars['String']>;
  in?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
  ne?: InputMaybe<Scalars['String']>;
  nin?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
  regex?: InputMaybe<Scalars['String']>;
};

export type _Entity = Continent | Country | Language;

export type _Service = {
  __typename?: '_Service';
  /** The sdl representing the federated service capabilities. Includes federation directives, removes federation types, and includes rest of full schema after schema directives have been applied */
  sdl?: Maybe<Scalars['String']>;
};


export default {
  introspection: {
    "__schema": {
      "queryType": {
        "name": "Query"
      },
      "mutationType": null,
      "subscriptionType": null,
      "types": [
        {
          "kind": "SCALAR",
          "name": "Boolean"
        },
        {
          "kind": "OBJECT",
          "name": "Continent",
          "fields": [
            {
              "name": "code",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "SCALAR",
                  "name": "ID",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "countries",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "LIST",
                  "ofType": {
                    "kind": "NON_NULL",
                    "ofType": {
                      "kind": "OBJECT",
                      "name": "Country",
                      "ofType": null
                    }
                  }
                }
              },
              "args": []
            },
            {
              "name": "name",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "SCALAR",
                  "name": "String",
                  "ofType": null
                }
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "INPUT_OBJECT",
          "name": "ContinentFilterInput",
          "inputFields": [
            {
              "name": "code",
              "type": {
                "kind": "INPUT_OBJECT",
                "name": "StringQueryOperatorInput",
                "ofType": null
              }
            }
          ]
        },
        {
          "kind": "OBJECT",
          "name": "Country",
          "fields": [
            {
              "name": "capital",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "code",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "SCALAR",
                  "name": "ID",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "continent",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Continent",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "currency",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "emoji",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "SCALAR",
                  "name": "String",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "emojiU",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "SCALAR",
                  "name": "String",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "languages",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "LIST",
                  "ofType": {
                    "kind": "NON_NULL",
                    "ofType": {
                      "kind": "OBJECT",
                      "name": "Language",
                      "ofType": null
                    }
                  }
                }
              },
              "args": []
            },
            {
              "name": "name",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "SCALAR",
                  "name": "String",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "native",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "SCALAR",
                  "name": "String",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "phone",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "SCALAR",
                  "name": "String",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "states",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "LIST",
                  "ofType": {
                    "kind": "NON_NULL",
                    "ofType": {
                      "kind": "OBJECT",
                      "name": "State",
                      "ofType": null
                    }
                  }
                }
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "INPUT_OBJECT",
          "name": "CountryFilterInput",
          "inputFields": [
            {
              "name": "code",
              "type": {
                "kind": "INPUT_OBJECT",
                "name": "StringQueryOperatorInput",
                "ofType": null
              }
            },
            {
              "name": "continent",
              "type": {
                "kind": "INPUT_OBJECT",
                "name": "StringQueryOperatorInput",
                "ofType": null
              }
            },
            {
              "name": "currency",
              "type": {
                "kind": "INPUT_OBJECT",
                "name": "StringQueryOperatorInput",
                "ofType": null
              }
            }
          ]
        },
        {
          "kind": "SCALAR",
          "name": "ID"
        },
        {
          "kind": "OBJECT",
          "name": "Language",
          "fields": [
            {
              "name": "code",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "SCALAR",
                  "name": "ID",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "name",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "native",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "rtl",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "SCALAR",
                  "name": "Boolean",
                  "ofType": null
                }
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "INPUT_OBJECT",
          "name": "LanguageFilterInput",
          "inputFields": [
            {
              "name": "code",
              "type": {
                "kind": "INPUT_OBJECT",
                "name": "StringQueryOperatorInput",
                "ofType": null
              }
            }
          ]
        },
        {
          "kind": "OBJECT",
          "name": "Query",
          "fields": [
            {
              "name": "_entities",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "LIST",
                  "ofType": {
                    "kind": "UNION",
                    "name": "_Entity",
                    "ofType": null
                  }
                }
              },
              "args": [
                {
                  "name": "representations",
                  "type": {
                    "kind": "NON_NULL",
                    "ofType": {
                      "kind": "LIST",
                      "ofType": {
                        "kind": "NON_NULL",
                        "ofType": {
                          "kind": "SCALAR",
                          "name": "_Any",
                          "ofType": null
                        }
                      }
                    }
                  }
                }
              ]
            },
            {
              "name": "_service",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "_Service",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "continent",
              "type": {
                "kind": "OBJECT",
                "name": "Continent",
                "ofType": null
              },
              "args": [
                {
                  "name": "code",
                  "type": {
                    "kind": "NON_NULL",
                    "ofType": {
                      "kind": "SCALAR",
                      "name": "ID",
                      "ofType": null
                    }
                  }
                }
              ]
            },
            {
              "name": "continents",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "LIST",
                  "ofType": {
                    "kind": "NON_NULL",
                    "ofType": {
                      "kind": "OBJECT",
                      "name": "Continent",
                      "ofType": null
                    }
                  }
                }
              },
              "args": [
                {
                  "name": "filter",
                  "type": {
                    "kind": "INPUT_OBJECT",
                    "name": "ContinentFilterInput",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "countries",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "LIST",
                  "ofType": {
                    "kind": "NON_NULL",
                    "ofType": {
                      "kind": "OBJECT",
                      "name": "Country",
                      "ofType": null
                    }
                  }
                }
              },
              "args": [
                {
                  "name": "filter",
                  "type": {
                    "kind": "INPUT_OBJECT",
                    "name": "CountryFilterInput",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "country",
              "type": {
                "kind": "OBJECT",
                "name": "Country",
                "ofType": null
              },
              "args": [
                {
                  "name": "code",
                  "type": {
                    "kind": "NON_NULL",
                    "ofType": {
                      "kind": "SCALAR",
                      "name": "ID",
                      "ofType": null
                    }
                  }
                }
              ]
            },
            {
              "name": "language",
              "type": {
                "kind": "OBJECT",
                "name": "Language",
                "ofType": null
              },
              "args": [
                {
                  "name": "code",
                  "type": {
                    "kind": "NON_NULL",
                    "ofType": {
                      "kind": "SCALAR",
                      "name": "ID",
                      "ofType": null
                    }
                  }
                }
              ]
            },
            {
              "name": "languages",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "LIST",
                  "ofType": {
                    "kind": "NON_NULL",
                    "ofType": {
                      "kind": "OBJECT",
                      "name": "Language",
                      "ofType": null
                    }
                  }
                }
              },
              "args": [
                {
                  "name": "filter",
                  "type": {
                    "kind": "INPUT_OBJECT",
                    "name": "LanguageFilterInput",
                    "ofType": null
                  }
                }
              ]
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "State",
          "fields": [
            {
              "name": "code",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "country",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Country",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "name",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "SCALAR",
                  "name": "String",
                  "ofType": null
                }
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "SCALAR",
          "name": "String"
        },
        {
          "kind": "INPUT_OBJECT",
          "name": "StringQueryOperatorInput",
          "inputFields": [
            {
              "name": "eq",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              }
            },
            {
              "name": "glob",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              }
            },
            {
              "name": "in",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "SCALAR",
                  "name": "String",
                  "ofType": null
                }
              }
            },
            {
              "name": "ne",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              }
            },
            {
              "name": "nin",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "SCALAR",
                  "name": "String",
                  "ofType": null
                }
              }
            },
            {
              "name": "regex",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              }
            }
          ]
        },
        {
          "kind": "SCALAR",
          "name": "_Any"
        },
        {
          "kind": "UNION",
          "name": "_Entity",
          "possibleTypes": [
            {
              "kind": "OBJECT",
              "name": "Continent"
            },
            {
              "kind": "OBJECT",
              "name": "Country"
            },
            {
              "kind": "OBJECT",
              "name": "Language"
            }
          ]
        },
        {
          "kind": "OBJECT",
          "name": "_Service",
          "fields": [
            {
              "name": "sdl",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "SCALAR",
          "name": "Any"
        }
      ],
      "directives": []
    }
  } as const,
  types: {} as {
    Scalars: Scalars,
    Continent: Continent,
    ContinentFilterInput: ContinentFilterInput,
    Country: Country,
    CountryFilterInput: CountryFilterInput,
    Language: Language,
    LanguageFilterInput: LanguageFilterInput,
    Query: Query,
    Query__EntitiesArgs: Query__EntitiesArgs,
    Query_ContinentArgs: Query_ContinentArgs,
    Query_ContinentsArgs: Query_ContinentsArgs,
    Query_CountriesArgs: Query_CountriesArgs,
    Query_CountryArgs: Query_CountryArgs,
    Query_LanguageArgs: Query_LanguageArgs,
    Query_LanguagesArgs: Query_LanguagesArgs,
    State: State,
    StringQueryOperatorInput: StringQueryOperatorInput,
    _Entity: _Entity,
    _Service: _Service
  }
}