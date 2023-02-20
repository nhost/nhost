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
};

export type Anyone = Dog | Hamster | Human;

export type Diet =
  | 'CARNIVOROUS'
  | 'HERBIVOROUS'
  | 'OMNIVORIOUS';

export type Dog = Pet & {
  __typename?: 'Dog';
  barks: Scalars['Boolean'];
  diet: Diet;
  name: Scalars['String'];
  owner: Human;
};

export type Hamster = Pet & {
  __typename?: 'Hamster';
  diet: Diet;
  name: Scalars['String'];
  owner: Human;
  squeaks: Scalars['Boolean'];
};

export type Human = {
  __typename?: 'Human';
  firstName: Scalars['String'];
  pets: Array<Pet>;
  phoneNumber: Scalars['String'];
};

export type Pet = {
  diet: Diet;
  name: Scalars['String'];
  owner: Human;
};

export type Query = {
  __typename?: 'Query';
  dogs: Array<Dog>;
  everyone: Array<Anyone>;
  hamsters: Array<Hamster>;
  pets: Array<Pet>;
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
          "kind": "UNION",
          "name": "Anyone",
          "possibleTypes": [
            {
              "kind": "OBJECT",
              "name": "Dog"
            },
            {
              "kind": "OBJECT",
              "name": "Hamster"
            },
            {
              "kind": "OBJECT",
              "name": "Human"
            }
          ]
        },
        {
          "kind": "SCALAR",
          "name": "Boolean"
        },
        {
          "kind": "ENUM",
          "name": "Diet",
          "enumValues": [
            {
              "name": "CARNIVOROUS"
            },
            {
              "name": "HERBIVOROUS"
            },
            {
              "name": "OMNIVORIOUS"
            }
          ]
        },
        {
          "kind": "OBJECT",
          "name": "Dog",
          "fields": [
            {
              "name": "barks",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "SCALAR",
                  "name": "Boolean",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "diet",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "ENUM",
                  "name": "Diet",
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
            },
            {
              "name": "owner",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Human",
                  "ofType": null
                }
              },
              "args": []
            }
          ],
          "interfaces": [
            {
              "kind": "INTERFACE",
              "name": "Pet"
            }
          ]
        },
        {
          "kind": "SCALAR",
          "name": "Float"
        },
        {
          "kind": "OBJECT",
          "name": "Hamster",
          "fields": [
            {
              "name": "diet",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "ENUM",
                  "name": "Diet",
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
            },
            {
              "name": "owner",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Human",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "squeaks",
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
          "interfaces": [
            {
              "kind": "INTERFACE",
              "name": "Pet"
            }
          ]
        },
        {
          "kind": "OBJECT",
          "name": "Human",
          "fields": [
            {
              "name": "firstName",
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
              "name": "pets",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "LIST",
                  "ofType": {
                    "kind": "NON_NULL",
                    "ofType": {
                      "kind": "INTERFACE",
                      "name": "Pet",
                      "ofType": null
                    }
                  }
                }
              },
              "args": []
            },
            {
              "name": "phoneNumber",
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
          "name": "ID"
        },
        {
          "kind": "SCALAR",
          "name": "Int"
        },
        {
          "kind": "INTERFACE",
          "name": "Pet",
          "fields": [
            {
              "name": "diet",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "ENUM",
                  "name": "Diet",
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
            },
            {
              "name": "owner",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Human",
                  "ofType": null
                }
              },
              "args": []
            }
          ],
          "interfaces": [],
          "possibleTypes": [
            {
              "kind": "OBJECT",
              "name": "Dog"
            },
            {
              "kind": "OBJECT",
              "name": "Hamster"
            }
          ]
        },
        {
          "kind": "OBJECT",
          "name": "Query",
          "fields": [
            {
              "name": "dogs",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "LIST",
                  "ofType": {
                    "kind": "NON_NULL",
                    "ofType": {
                      "kind": "OBJECT",
                      "name": "Dog",
                      "ofType": null
                    }
                  }
                }
              },
              "args": []
            },
            {
              "name": "everyone",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "LIST",
                  "ofType": {
                    "kind": "NON_NULL",
                    "ofType": {
                      "kind": "UNION",
                      "name": "Anyone",
                      "ofType": null
                    }
                  }
                }
              },
              "args": []
            },
            {
              "name": "hamsters",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "LIST",
                  "ofType": {
                    "kind": "NON_NULL",
                    "ofType": {
                      "kind": "OBJECT",
                      "name": "Hamster",
                      "ofType": null
                    }
                  }
                }
              },
              "args": []
            },
            {
              "name": "pets",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "LIST",
                  "ofType": {
                    "kind": "NON_NULL",
                    "ofType": {
                      "kind": "INTERFACE",
                      "name": "Pet",
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
          "kind": "SCALAR",
          "name": "String"
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
    Anyone: Anyone,
    Dog: Dog,
    Hamster: Hamster,
    Human: Human,
    Pet: Pet,
    Query: Query
  }
}