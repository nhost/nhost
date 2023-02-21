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

/** A single film. */
export type Film = Node & {
  __typename?: 'Film';
  characterConnection?: Maybe<FilmCharactersConnection>;
  /** The ISO 8601 date format of the time that this resource was created. */
  created?: Maybe<Scalars['String']>;
  /** The name of the director of this film. */
  director?: Maybe<Scalars['String']>;
  /** The ISO 8601 date format of the time that this resource was edited. */
  edited?: Maybe<Scalars['String']>;
  /** The episode number of this film. */
  episodeID?: Maybe<Scalars['Int']>;
  /** The ID of an object */
  id: Scalars['ID'];
  /** The opening paragraphs at the beginning of this film. */
  openingCrawl?: Maybe<Scalars['String']>;
  planetConnection?: Maybe<FilmPlanetsConnection>;
  /** The name(s) of the producer(s) of this film. */
  producers?: Maybe<Array<Maybe<Scalars['String']>>>;
  /** The ISO 8601 date format of film release at original creator country. */
  releaseDate?: Maybe<Scalars['String']>;
  speciesConnection?: Maybe<FilmSpeciesConnection>;
  starshipConnection?: Maybe<FilmStarshipsConnection>;
  /** The title of this film. */
  title?: Maybe<Scalars['String']>;
  vehicleConnection?: Maybe<FilmVehiclesConnection>;
};


/** A single film. */
export type Film_CharacterConnectionArgs = {
  after?: InputMaybe<Scalars['String']>;
  before?: InputMaybe<Scalars['String']>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
};


/** A single film. */
export type Film_PlanetConnectionArgs = {
  after?: InputMaybe<Scalars['String']>;
  before?: InputMaybe<Scalars['String']>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
};


/** A single film. */
export type Film_SpeciesConnectionArgs = {
  after?: InputMaybe<Scalars['String']>;
  before?: InputMaybe<Scalars['String']>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
};


/** A single film. */
export type Film_StarshipConnectionArgs = {
  after?: InputMaybe<Scalars['String']>;
  before?: InputMaybe<Scalars['String']>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
};


/** A single film. */
export type Film_VehicleConnectionArgs = {
  after?: InputMaybe<Scalars['String']>;
  before?: InputMaybe<Scalars['String']>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
};

/** A connection to a list of items. */
export type FilmCharactersConnection = {
  __typename?: 'FilmCharactersConnection';
  /**
   * A list of all of the objects returned in the connection. This is a convenience
   * field provided for quickly exploring the API; rather than querying for
   * "{ edges { node } }" when no edge data is needed, this field can be be used
   * instead. Note that when clients like Relay need to fetch the "cursor" field on
   * the edge to enable efficient pagination, this shortcut cannot be used, and the
   * full "{ edges { node } }" version should be used instead.
   */
  characters?: Maybe<Array<Maybe<Person>>>;
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<FilmCharactersEdge>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /**
   * A count of the total number of objects in this connection, ignoring pagination.
   * This allows a client to fetch the first five objects by passing "5" as the
   * argument to "first", then fetch the total count so it could display "5 of 83",
   * for example.
   */
  totalCount?: Maybe<Scalars['Int']>;
};

/** An edge in a connection. */
export type FilmCharactersEdge = {
  __typename?: 'FilmCharactersEdge';
  /** A cursor for use in pagination */
  cursor: Scalars['String'];
  /** The item at the end of the edge */
  node?: Maybe<Person>;
};

/** A connection to a list of items. */
export type FilmPlanetsConnection = {
  __typename?: 'FilmPlanetsConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<FilmPlanetsEdge>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /**
   * A list of all of the objects returned in the connection. This is a convenience
   * field provided for quickly exploring the API; rather than querying for
   * "{ edges { node } }" when no edge data is needed, this field can be be used
   * instead. Note that when clients like Relay need to fetch the "cursor" field on
   * the edge to enable efficient pagination, this shortcut cannot be used, and the
   * full "{ edges { node } }" version should be used instead.
   */
  planets?: Maybe<Array<Maybe<Planet>>>;
  /**
   * A count of the total number of objects in this connection, ignoring pagination.
   * This allows a client to fetch the first five objects by passing "5" as the
   * argument to "first", then fetch the total count so it could display "5 of 83",
   * for example.
   */
  totalCount?: Maybe<Scalars['Int']>;
};

/** An edge in a connection. */
export type FilmPlanetsEdge = {
  __typename?: 'FilmPlanetsEdge';
  /** A cursor for use in pagination */
  cursor: Scalars['String'];
  /** The item at the end of the edge */
  node?: Maybe<Planet>;
};

/** A connection to a list of items. */
export type FilmSpeciesConnection = {
  __typename?: 'FilmSpeciesConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<FilmSpeciesEdge>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /**
   * A list of all of the objects returned in the connection. This is a convenience
   * field provided for quickly exploring the API; rather than querying for
   * "{ edges { node } }" when no edge data is needed, this field can be be used
   * instead. Note that when clients like Relay need to fetch the "cursor" field on
   * the edge to enable efficient pagination, this shortcut cannot be used, and the
   * full "{ edges { node } }" version should be used instead.
   */
  species?: Maybe<Array<Maybe<Species>>>;
  /**
   * A count of the total number of objects in this connection, ignoring pagination.
   * This allows a client to fetch the first five objects by passing "5" as the
   * argument to "first", then fetch the total count so it could display "5 of 83",
   * for example.
   */
  totalCount?: Maybe<Scalars['Int']>;
};

/** An edge in a connection. */
export type FilmSpeciesEdge = {
  __typename?: 'FilmSpeciesEdge';
  /** A cursor for use in pagination */
  cursor: Scalars['String'];
  /** The item at the end of the edge */
  node?: Maybe<Species>;
};

/** A connection to a list of items. */
export type FilmStarshipsConnection = {
  __typename?: 'FilmStarshipsConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<FilmStarshipsEdge>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /**
   * A list of all of the objects returned in the connection. This is a convenience
   * field provided for quickly exploring the API; rather than querying for
   * "{ edges { node } }" when no edge data is needed, this field can be be used
   * instead. Note that when clients like Relay need to fetch the "cursor" field on
   * the edge to enable efficient pagination, this shortcut cannot be used, and the
   * full "{ edges { node } }" version should be used instead.
   */
  starships?: Maybe<Array<Maybe<Starship>>>;
  /**
   * A count of the total number of objects in this connection, ignoring pagination.
   * This allows a client to fetch the first five objects by passing "5" as the
   * argument to "first", then fetch the total count so it could display "5 of 83",
   * for example.
   */
  totalCount?: Maybe<Scalars['Int']>;
};

/** An edge in a connection. */
export type FilmStarshipsEdge = {
  __typename?: 'FilmStarshipsEdge';
  /** A cursor for use in pagination */
  cursor: Scalars['String'];
  /** The item at the end of the edge */
  node?: Maybe<Starship>;
};

/** A connection to a list of items. */
export type FilmVehiclesConnection = {
  __typename?: 'FilmVehiclesConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<FilmVehiclesEdge>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /**
   * A count of the total number of objects in this connection, ignoring pagination.
   * This allows a client to fetch the first five objects by passing "5" as the
   * argument to "first", then fetch the total count so it could display "5 of 83",
   * for example.
   */
  totalCount?: Maybe<Scalars['Int']>;
  /**
   * A list of all of the objects returned in the connection. This is a convenience
   * field provided for quickly exploring the API; rather than querying for
   * "{ edges { node } }" when no edge data is needed, this field can be be used
   * instead. Note that when clients like Relay need to fetch the "cursor" field on
   * the edge to enable efficient pagination, this shortcut cannot be used, and the
   * full "{ edges { node } }" version should be used instead.
   */
  vehicles?: Maybe<Array<Maybe<Vehicle>>>;
};

/** An edge in a connection. */
export type FilmVehiclesEdge = {
  __typename?: 'FilmVehiclesEdge';
  /** A cursor for use in pagination */
  cursor: Scalars['String'];
  /** The item at the end of the edge */
  node?: Maybe<Vehicle>;
};

/** A connection to a list of items. */
export type FilmsConnection = {
  __typename?: 'FilmsConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<FilmsEdge>>>;
  /**
   * A list of all of the objects returned in the connection. This is a convenience
   * field provided for quickly exploring the API; rather than querying for
   * "{ edges { node } }" when no edge data is needed, this field can be be used
   * instead. Note that when clients like Relay need to fetch the "cursor" field on
   * the edge to enable efficient pagination, this shortcut cannot be used, and the
   * full "{ edges { node } }" version should be used instead.
   */
  films?: Maybe<Array<Maybe<Film>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /**
   * A count of the total number of objects in this connection, ignoring pagination.
   * This allows a client to fetch the first five objects by passing "5" as the
   * argument to "first", then fetch the total count so it could display "5 of 83",
   * for example.
   */
  totalCount?: Maybe<Scalars['Int']>;
};

/** An edge in a connection. */
export type FilmsEdge = {
  __typename?: 'FilmsEdge';
  /** A cursor for use in pagination */
  cursor: Scalars['String'];
  /** The item at the end of the edge */
  node?: Maybe<Film>;
};

/** An object with an ID */
export type Node = {
  /** The id of the object. */
  id: Scalars['ID'];
};

/** Information about pagination in a connection. */
export type PageInfo = {
  __typename?: 'PageInfo';
  /** When paginating forwards, the cursor to continue. */
  endCursor?: Maybe<Scalars['String']>;
  /** When paginating forwards, are there more items? */
  hasNextPage: Scalars['Boolean'];
  /** When paginating backwards, are there more items? */
  hasPreviousPage: Scalars['Boolean'];
  /** When paginating backwards, the cursor to continue. */
  startCursor?: Maybe<Scalars['String']>;
};

/** A connection to a list of items. */
export type PeopleConnection = {
  __typename?: 'PeopleConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<PeopleEdge>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /**
   * A list of all of the objects returned in the connection. This is a convenience
   * field provided for quickly exploring the API; rather than querying for
   * "{ edges { node } }" when no edge data is needed, this field can be be used
   * instead. Note that when clients like Relay need to fetch the "cursor" field on
   * the edge to enable efficient pagination, this shortcut cannot be used, and the
   * full "{ edges { node } }" version should be used instead.
   */
  people?: Maybe<Array<Maybe<Person>>>;
  /**
   * A count of the total number of objects in this connection, ignoring pagination.
   * This allows a client to fetch the first five objects by passing "5" as the
   * argument to "first", then fetch the total count so it could display "5 of 83",
   * for example.
   */
  totalCount?: Maybe<Scalars['Int']>;
};

/** An edge in a connection. */
export type PeopleEdge = {
  __typename?: 'PeopleEdge';
  /** A cursor for use in pagination */
  cursor: Scalars['String'];
  /** The item at the end of the edge */
  node?: Maybe<Person>;
};

/** An individual person or character within the Star Wars universe. */
export type Person = Node & {
  __typename?: 'Person';
  /**
   * The birth year of the person, using the in-universe standard of BBY or ABY -
   * Before the Battle of Yavin or After the Battle of Yavin. The Battle of Yavin is
   * a battle that occurs at the end of Star Wars episode IV: A New Hope.
   */
  birthYear?: Maybe<Scalars['String']>;
  /** The ISO 8601 date format of the time that this resource was created. */
  created?: Maybe<Scalars['String']>;
  /** The ISO 8601 date format of the time that this resource was edited. */
  edited?: Maybe<Scalars['String']>;
  /**
   * The eye color of this person. Will be "unknown" if not known or "n/a" if the
   * person does not have an eye.
   */
  eyeColor?: Maybe<Scalars['String']>;
  filmConnection?: Maybe<PersonFilmsConnection>;
  /**
   * The gender of this person. Either "Male", "Female" or "unknown",
   * "n/a" if the person does not have a gender.
   */
  gender?: Maybe<Scalars['String']>;
  /**
   * The hair color of this person. Will be "unknown" if not known or "n/a" if the
   * person does not have hair.
   */
  hairColor?: Maybe<Scalars['String']>;
  /** The height of the person in centimeters. */
  height?: Maybe<Scalars['Int']>;
  /** A planet that this person was born on or inhabits. */
  homeworld?: Maybe<Planet>;
  /** The ID of an object */
  id: Scalars['ID'];
  /** The mass of the person in kilograms. */
  mass?: Maybe<Scalars['Float']>;
  /** The name of this person. */
  name?: Maybe<Scalars['String']>;
  /** The skin color of this person. */
  skinColor?: Maybe<Scalars['String']>;
  /** The species that this person belongs to, or null if unknown. */
  species?: Maybe<Species>;
  starshipConnection?: Maybe<PersonStarshipsConnection>;
  vehicleConnection?: Maybe<PersonVehiclesConnection>;
};


/** An individual person or character within the Star Wars universe. */
export type Person_FilmConnectionArgs = {
  after?: InputMaybe<Scalars['String']>;
  before?: InputMaybe<Scalars['String']>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
};


/** An individual person or character within the Star Wars universe. */
export type Person_StarshipConnectionArgs = {
  after?: InputMaybe<Scalars['String']>;
  before?: InputMaybe<Scalars['String']>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
};


/** An individual person or character within the Star Wars universe. */
export type Person_VehicleConnectionArgs = {
  after?: InputMaybe<Scalars['String']>;
  before?: InputMaybe<Scalars['String']>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
};

/** A connection to a list of items. */
export type PersonFilmsConnection = {
  __typename?: 'PersonFilmsConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<PersonFilmsEdge>>>;
  /**
   * A list of all of the objects returned in the connection. This is a convenience
   * field provided for quickly exploring the API; rather than querying for
   * "{ edges { node } }" when no edge data is needed, this field can be be used
   * instead. Note that when clients like Relay need to fetch the "cursor" field on
   * the edge to enable efficient pagination, this shortcut cannot be used, and the
   * full "{ edges { node } }" version should be used instead.
   */
  films?: Maybe<Array<Maybe<Film>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /**
   * A count of the total number of objects in this connection, ignoring pagination.
   * This allows a client to fetch the first five objects by passing "5" as the
   * argument to "first", then fetch the total count so it could display "5 of 83",
   * for example.
   */
  totalCount?: Maybe<Scalars['Int']>;
};

/** An edge in a connection. */
export type PersonFilmsEdge = {
  __typename?: 'PersonFilmsEdge';
  /** A cursor for use in pagination */
  cursor: Scalars['String'];
  /** The item at the end of the edge */
  node?: Maybe<Film>;
};

/** A connection to a list of items. */
export type PersonStarshipsConnection = {
  __typename?: 'PersonStarshipsConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<PersonStarshipsEdge>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /**
   * A list of all of the objects returned in the connection. This is a convenience
   * field provided for quickly exploring the API; rather than querying for
   * "{ edges { node } }" when no edge data is needed, this field can be be used
   * instead. Note that when clients like Relay need to fetch the "cursor" field on
   * the edge to enable efficient pagination, this shortcut cannot be used, and the
   * full "{ edges { node } }" version should be used instead.
   */
  starships?: Maybe<Array<Maybe<Starship>>>;
  /**
   * A count of the total number of objects in this connection, ignoring pagination.
   * This allows a client to fetch the first five objects by passing "5" as the
   * argument to "first", then fetch the total count so it could display "5 of 83",
   * for example.
   */
  totalCount?: Maybe<Scalars['Int']>;
};

/** An edge in a connection. */
export type PersonStarshipsEdge = {
  __typename?: 'PersonStarshipsEdge';
  /** A cursor for use in pagination */
  cursor: Scalars['String'];
  /** The item at the end of the edge */
  node?: Maybe<Starship>;
};

/** A connection to a list of items. */
export type PersonVehiclesConnection = {
  __typename?: 'PersonVehiclesConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<PersonVehiclesEdge>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /**
   * A count of the total number of objects in this connection, ignoring pagination.
   * This allows a client to fetch the first five objects by passing "5" as the
   * argument to "first", then fetch the total count so it could display "5 of 83",
   * for example.
   */
  totalCount?: Maybe<Scalars['Int']>;
  /**
   * A list of all of the objects returned in the connection. This is a convenience
   * field provided for quickly exploring the API; rather than querying for
   * "{ edges { node } }" when no edge data is needed, this field can be be used
   * instead. Note that when clients like Relay need to fetch the "cursor" field on
   * the edge to enable efficient pagination, this shortcut cannot be used, and the
   * full "{ edges { node } }" version should be used instead.
   */
  vehicles?: Maybe<Array<Maybe<Vehicle>>>;
};

/** An edge in a connection. */
export type PersonVehiclesEdge = {
  __typename?: 'PersonVehiclesEdge';
  /** A cursor for use in pagination */
  cursor: Scalars['String'];
  /** The item at the end of the edge */
  node?: Maybe<Vehicle>;
};

/**
 * A large mass, planet or planetoid in the Star Wars Universe, at the time of
 * 0 ABY.
 */
export type Planet = Node & {
  __typename?: 'Planet';
  /** The climates of this planet. */
  climates?: Maybe<Array<Maybe<Scalars['String']>>>;
  /** The ISO 8601 date format of the time that this resource was created. */
  created?: Maybe<Scalars['String']>;
  /** The diameter of this planet in kilometers. */
  diameter?: Maybe<Scalars['Int']>;
  /** The ISO 8601 date format of the time that this resource was edited. */
  edited?: Maybe<Scalars['String']>;
  filmConnection?: Maybe<PlanetFilmsConnection>;
  /**
   * A number denoting the gravity of this planet, where "1" is normal or 1 standard
   * G. "2" is twice or 2 standard Gs. "0.5" is half or 0.5 standard Gs.
   */
  gravity?: Maybe<Scalars['String']>;
  /** The ID of an object */
  id: Scalars['ID'];
  /** The name of this planet. */
  name?: Maybe<Scalars['String']>;
  /**
   * The number of standard days it takes for this planet to complete a single orbit
   * of its local star.
   */
  orbitalPeriod?: Maybe<Scalars['Int']>;
  /** The average population of sentient beings inhabiting this planet. */
  population?: Maybe<Scalars['Float']>;
  residentConnection?: Maybe<PlanetResidentsConnection>;
  /**
   * The number of standard hours it takes for this planet to complete a single
   * rotation on its axis.
   */
  rotationPeriod?: Maybe<Scalars['Int']>;
  /**
   * The percentage of the planet surface that is naturally occurring water or bodies
   * of water.
   */
  surfaceWater?: Maybe<Scalars['Float']>;
  /** The terrains of this planet. */
  terrains?: Maybe<Array<Maybe<Scalars['String']>>>;
};


/**
 * A large mass, planet or planetoid in the Star Wars Universe, at the time of
 * 0 ABY.
 */
export type Planet_FilmConnectionArgs = {
  after?: InputMaybe<Scalars['String']>;
  before?: InputMaybe<Scalars['String']>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
};


/**
 * A large mass, planet or planetoid in the Star Wars Universe, at the time of
 * 0 ABY.
 */
export type Planet_ResidentConnectionArgs = {
  after?: InputMaybe<Scalars['String']>;
  before?: InputMaybe<Scalars['String']>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
};

/** A connection to a list of items. */
export type PlanetFilmsConnection = {
  __typename?: 'PlanetFilmsConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<PlanetFilmsEdge>>>;
  /**
   * A list of all of the objects returned in the connection. This is a convenience
   * field provided for quickly exploring the API; rather than querying for
   * "{ edges { node } }" when no edge data is needed, this field can be be used
   * instead. Note that when clients like Relay need to fetch the "cursor" field on
   * the edge to enable efficient pagination, this shortcut cannot be used, and the
   * full "{ edges { node } }" version should be used instead.
   */
  films?: Maybe<Array<Maybe<Film>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /**
   * A count of the total number of objects in this connection, ignoring pagination.
   * This allows a client to fetch the first five objects by passing "5" as the
   * argument to "first", then fetch the total count so it could display "5 of 83",
   * for example.
   */
  totalCount?: Maybe<Scalars['Int']>;
};

/** An edge in a connection. */
export type PlanetFilmsEdge = {
  __typename?: 'PlanetFilmsEdge';
  /** A cursor for use in pagination */
  cursor: Scalars['String'];
  /** The item at the end of the edge */
  node?: Maybe<Film>;
};

/** A connection to a list of items. */
export type PlanetResidentsConnection = {
  __typename?: 'PlanetResidentsConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<PlanetResidentsEdge>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /**
   * A list of all of the objects returned in the connection. This is a convenience
   * field provided for quickly exploring the API; rather than querying for
   * "{ edges { node } }" when no edge data is needed, this field can be be used
   * instead. Note that when clients like Relay need to fetch the "cursor" field on
   * the edge to enable efficient pagination, this shortcut cannot be used, and the
   * full "{ edges { node } }" version should be used instead.
   */
  residents?: Maybe<Array<Maybe<Person>>>;
  /**
   * A count of the total number of objects in this connection, ignoring pagination.
   * This allows a client to fetch the first five objects by passing "5" as the
   * argument to "first", then fetch the total count so it could display "5 of 83",
   * for example.
   */
  totalCount?: Maybe<Scalars['Int']>;
};

/** An edge in a connection. */
export type PlanetResidentsEdge = {
  __typename?: 'PlanetResidentsEdge';
  /** A cursor for use in pagination */
  cursor: Scalars['String'];
  /** The item at the end of the edge */
  node?: Maybe<Person>;
};

/** A connection to a list of items. */
export type PlanetsConnection = {
  __typename?: 'PlanetsConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<PlanetsEdge>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /**
   * A list of all of the objects returned in the connection. This is a convenience
   * field provided for quickly exploring the API; rather than querying for
   * "{ edges { node } }" when no edge data is needed, this field can be be used
   * instead. Note that when clients like Relay need to fetch the "cursor" field on
   * the edge to enable efficient pagination, this shortcut cannot be used, and the
   * full "{ edges { node } }" version should be used instead.
   */
  planets?: Maybe<Array<Maybe<Planet>>>;
  /**
   * A count of the total number of objects in this connection, ignoring pagination.
   * This allows a client to fetch the first five objects by passing "5" as the
   * argument to "first", then fetch the total count so it could display "5 of 83",
   * for example.
   */
  totalCount?: Maybe<Scalars['Int']>;
};

/** An edge in a connection. */
export type PlanetsEdge = {
  __typename?: 'PlanetsEdge';
  /** A cursor for use in pagination */
  cursor: Scalars['String'];
  /** The item at the end of the edge */
  node?: Maybe<Planet>;
};

export type Root = {
  __typename?: 'Root';
  allFilms?: Maybe<FilmsConnection>;
  allPeople?: Maybe<PeopleConnection>;
  allPlanets?: Maybe<PlanetsConnection>;
  allSpecies?: Maybe<SpeciesConnection>;
  allStarships?: Maybe<StarshipsConnection>;
  allVehicles?: Maybe<VehiclesConnection>;
  film?: Maybe<Film>;
  /** Fetches an object given its ID */
  node?: Maybe<Node>;
  person?: Maybe<Person>;
  planet?: Maybe<Planet>;
  species?: Maybe<Species>;
  starship?: Maybe<Starship>;
  vehicle?: Maybe<Vehicle>;
};


export type Root_AllFilmsArgs = {
  after?: InputMaybe<Scalars['String']>;
  before?: InputMaybe<Scalars['String']>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
};


export type Root_AllPeopleArgs = {
  after?: InputMaybe<Scalars['String']>;
  before?: InputMaybe<Scalars['String']>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
};


export type Root_AllPlanetsArgs = {
  after?: InputMaybe<Scalars['String']>;
  before?: InputMaybe<Scalars['String']>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
};


export type Root_AllSpeciesArgs = {
  after?: InputMaybe<Scalars['String']>;
  before?: InputMaybe<Scalars['String']>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
};


export type Root_AllStarshipsArgs = {
  after?: InputMaybe<Scalars['String']>;
  before?: InputMaybe<Scalars['String']>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
};


export type Root_AllVehiclesArgs = {
  after?: InputMaybe<Scalars['String']>;
  before?: InputMaybe<Scalars['String']>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
};


export type Root_FilmArgs = {
  filmID?: InputMaybe<Scalars['ID']>;
  id?: InputMaybe<Scalars['ID']>;
};


export type Root_NodeArgs = {
  id: Scalars['ID'];
};


export type Root_PersonArgs = {
  id?: InputMaybe<Scalars['ID']>;
  personID?: InputMaybe<Scalars['ID']>;
};


export type Root_PlanetArgs = {
  id?: InputMaybe<Scalars['ID']>;
  planetID?: InputMaybe<Scalars['ID']>;
};


export type Root_SpeciesArgs = {
  id?: InputMaybe<Scalars['ID']>;
  speciesID?: InputMaybe<Scalars['ID']>;
};


export type Root_StarshipArgs = {
  id?: InputMaybe<Scalars['ID']>;
  starshipID?: InputMaybe<Scalars['ID']>;
};


export type Root_VehicleArgs = {
  id?: InputMaybe<Scalars['ID']>;
  vehicleID?: InputMaybe<Scalars['ID']>;
};

/** A type of person or character within the Star Wars Universe. */
export type Species = Node & {
  __typename?: 'Species';
  /** The average height of this species in centimeters. */
  averageHeight?: Maybe<Scalars['Float']>;
  /** The average lifespan of this species in years, null if unknown. */
  averageLifespan?: Maybe<Scalars['Int']>;
  /** The classification of this species, such as "mammal" or "reptile". */
  classification?: Maybe<Scalars['String']>;
  /** The ISO 8601 date format of the time that this resource was created. */
  created?: Maybe<Scalars['String']>;
  /** The designation of this species, such as "sentient". */
  designation?: Maybe<Scalars['String']>;
  /** The ISO 8601 date format of the time that this resource was edited. */
  edited?: Maybe<Scalars['String']>;
  /**
   * Common eye colors for this species, null if this species does not typically
   * have eyes.
   */
  eyeColors?: Maybe<Array<Maybe<Scalars['String']>>>;
  filmConnection?: Maybe<SpeciesFilmsConnection>;
  /**
   * Common hair colors for this species, null if this species does not typically
   * have hair.
   */
  hairColors?: Maybe<Array<Maybe<Scalars['String']>>>;
  /** A planet that this species originates from. */
  homeworld?: Maybe<Planet>;
  /** The ID of an object */
  id: Scalars['ID'];
  /** The language commonly spoken by this species. */
  language?: Maybe<Scalars['String']>;
  /** The name of this species. */
  name?: Maybe<Scalars['String']>;
  personConnection?: Maybe<SpeciesPeopleConnection>;
  /**
   * Common skin colors for this species, null if this species does not typically
   * have skin.
   */
  skinColors?: Maybe<Array<Maybe<Scalars['String']>>>;
};


/** A type of person or character within the Star Wars Universe. */
export type Species_FilmConnectionArgs = {
  after?: InputMaybe<Scalars['String']>;
  before?: InputMaybe<Scalars['String']>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
};


/** A type of person or character within the Star Wars Universe. */
export type Species_PersonConnectionArgs = {
  after?: InputMaybe<Scalars['String']>;
  before?: InputMaybe<Scalars['String']>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
};

/** A connection to a list of items. */
export type SpeciesConnection = {
  __typename?: 'SpeciesConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<SpeciesEdge>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /**
   * A list of all of the objects returned in the connection. This is a convenience
   * field provided for quickly exploring the API; rather than querying for
   * "{ edges { node } }" when no edge data is needed, this field can be be used
   * instead. Note that when clients like Relay need to fetch the "cursor" field on
   * the edge to enable efficient pagination, this shortcut cannot be used, and the
   * full "{ edges { node } }" version should be used instead.
   */
  species?: Maybe<Array<Maybe<Species>>>;
  /**
   * A count of the total number of objects in this connection, ignoring pagination.
   * This allows a client to fetch the first five objects by passing "5" as the
   * argument to "first", then fetch the total count so it could display "5 of 83",
   * for example.
   */
  totalCount?: Maybe<Scalars['Int']>;
};

/** An edge in a connection. */
export type SpeciesEdge = {
  __typename?: 'SpeciesEdge';
  /** A cursor for use in pagination */
  cursor: Scalars['String'];
  /** The item at the end of the edge */
  node?: Maybe<Species>;
};

/** A connection to a list of items. */
export type SpeciesFilmsConnection = {
  __typename?: 'SpeciesFilmsConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<SpeciesFilmsEdge>>>;
  /**
   * A list of all of the objects returned in the connection. This is a convenience
   * field provided for quickly exploring the API; rather than querying for
   * "{ edges { node } }" when no edge data is needed, this field can be be used
   * instead. Note that when clients like Relay need to fetch the "cursor" field on
   * the edge to enable efficient pagination, this shortcut cannot be used, and the
   * full "{ edges { node } }" version should be used instead.
   */
  films?: Maybe<Array<Maybe<Film>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /**
   * A count of the total number of objects in this connection, ignoring pagination.
   * This allows a client to fetch the first five objects by passing "5" as the
   * argument to "first", then fetch the total count so it could display "5 of 83",
   * for example.
   */
  totalCount?: Maybe<Scalars['Int']>;
};

/** An edge in a connection. */
export type SpeciesFilmsEdge = {
  __typename?: 'SpeciesFilmsEdge';
  /** A cursor for use in pagination */
  cursor: Scalars['String'];
  /** The item at the end of the edge */
  node?: Maybe<Film>;
};

/** A connection to a list of items. */
export type SpeciesPeopleConnection = {
  __typename?: 'SpeciesPeopleConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<SpeciesPeopleEdge>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /**
   * A list of all of the objects returned in the connection. This is a convenience
   * field provided for quickly exploring the API; rather than querying for
   * "{ edges { node } }" when no edge data is needed, this field can be be used
   * instead. Note that when clients like Relay need to fetch the "cursor" field on
   * the edge to enable efficient pagination, this shortcut cannot be used, and the
   * full "{ edges { node } }" version should be used instead.
   */
  people?: Maybe<Array<Maybe<Person>>>;
  /**
   * A count of the total number of objects in this connection, ignoring pagination.
   * This allows a client to fetch the first five objects by passing "5" as the
   * argument to "first", then fetch the total count so it could display "5 of 83",
   * for example.
   */
  totalCount?: Maybe<Scalars['Int']>;
};

/** An edge in a connection. */
export type SpeciesPeopleEdge = {
  __typename?: 'SpeciesPeopleEdge';
  /** A cursor for use in pagination */
  cursor: Scalars['String'];
  /** The item at the end of the edge */
  node?: Maybe<Person>;
};

/** A single transport craft that has hyperdrive capability. */
export type Starship = Node & {
  __typename?: 'Starship';
  /**
   * The Maximum number of Megalights this starship can travel in a standard hour.
   * A "Megalight" is a standard unit of distance and has never been defined before
   * within the Star Wars universe. This figure is only really useful for measuring
   * the difference in speed of starships. We can assume it is similar to AU, the
   * distance between our Sun (Sol) and Earth.
   */
  MGLT?: Maybe<Scalars['Int']>;
  /** The maximum number of kilograms that this starship can transport. */
  cargoCapacity?: Maybe<Scalars['Float']>;
  /**
   * The maximum length of time that this starship can provide consumables for its
   * entire crew without having to resupply.
   */
  consumables?: Maybe<Scalars['String']>;
  /** The cost of this starship new, in galactic credits. */
  costInCredits?: Maybe<Scalars['Float']>;
  /** The ISO 8601 date format of the time that this resource was created. */
  created?: Maybe<Scalars['String']>;
  /** The number of personnel needed to run or pilot this starship. */
  crew?: Maybe<Scalars['String']>;
  /** The ISO 8601 date format of the time that this resource was edited. */
  edited?: Maybe<Scalars['String']>;
  filmConnection?: Maybe<StarshipFilmsConnection>;
  /** The class of this starships hyperdrive. */
  hyperdriveRating?: Maybe<Scalars['Float']>;
  /** The ID of an object */
  id: Scalars['ID'];
  /** The length of this starship in meters. */
  length?: Maybe<Scalars['Float']>;
  /** The manufacturers of this starship. */
  manufacturers?: Maybe<Array<Maybe<Scalars['String']>>>;
  /**
   * The maximum speed of this starship in atmosphere. null if this starship is
   * incapable of atmosphering flight.
   */
  maxAtmospheringSpeed?: Maybe<Scalars['Int']>;
  /**
   * The model or official name of this starship. Such as "T-65 X-wing" or "DS-1
   * Orbital Battle Station".
   */
  model?: Maybe<Scalars['String']>;
  /** The name of this starship. The common name, such as "Death Star". */
  name?: Maybe<Scalars['String']>;
  /** The number of non-essential people this starship can transport. */
  passengers?: Maybe<Scalars['String']>;
  pilotConnection?: Maybe<StarshipPilotsConnection>;
  /**
   * The class of this starship, such as "Starfighter" or "Deep Space Mobile
   * Battlestation"
   */
  starshipClass?: Maybe<Scalars['String']>;
};


/** A single transport craft that has hyperdrive capability. */
export type Starship_FilmConnectionArgs = {
  after?: InputMaybe<Scalars['String']>;
  before?: InputMaybe<Scalars['String']>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
};


/** A single transport craft that has hyperdrive capability. */
export type Starship_PilotConnectionArgs = {
  after?: InputMaybe<Scalars['String']>;
  before?: InputMaybe<Scalars['String']>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
};

/** A connection to a list of items. */
export type StarshipFilmsConnection = {
  __typename?: 'StarshipFilmsConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<StarshipFilmsEdge>>>;
  /**
   * A list of all of the objects returned in the connection. This is a convenience
   * field provided for quickly exploring the API; rather than querying for
   * "{ edges { node } }" when no edge data is needed, this field can be be used
   * instead. Note that when clients like Relay need to fetch the "cursor" field on
   * the edge to enable efficient pagination, this shortcut cannot be used, and the
   * full "{ edges { node } }" version should be used instead.
   */
  films?: Maybe<Array<Maybe<Film>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /**
   * A count of the total number of objects in this connection, ignoring pagination.
   * This allows a client to fetch the first five objects by passing "5" as the
   * argument to "first", then fetch the total count so it could display "5 of 83",
   * for example.
   */
  totalCount?: Maybe<Scalars['Int']>;
};

/** An edge in a connection. */
export type StarshipFilmsEdge = {
  __typename?: 'StarshipFilmsEdge';
  /** A cursor for use in pagination */
  cursor: Scalars['String'];
  /** The item at the end of the edge */
  node?: Maybe<Film>;
};

/** A connection to a list of items. */
export type StarshipPilotsConnection = {
  __typename?: 'StarshipPilotsConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<StarshipPilotsEdge>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /**
   * A list of all of the objects returned in the connection. This is a convenience
   * field provided for quickly exploring the API; rather than querying for
   * "{ edges { node } }" when no edge data is needed, this field can be be used
   * instead. Note that when clients like Relay need to fetch the "cursor" field on
   * the edge to enable efficient pagination, this shortcut cannot be used, and the
   * full "{ edges { node } }" version should be used instead.
   */
  pilots?: Maybe<Array<Maybe<Person>>>;
  /**
   * A count of the total number of objects in this connection, ignoring pagination.
   * This allows a client to fetch the first five objects by passing "5" as the
   * argument to "first", then fetch the total count so it could display "5 of 83",
   * for example.
   */
  totalCount?: Maybe<Scalars['Int']>;
};

/** An edge in a connection. */
export type StarshipPilotsEdge = {
  __typename?: 'StarshipPilotsEdge';
  /** A cursor for use in pagination */
  cursor: Scalars['String'];
  /** The item at the end of the edge */
  node?: Maybe<Person>;
};

/** A connection to a list of items. */
export type StarshipsConnection = {
  __typename?: 'StarshipsConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<StarshipsEdge>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /**
   * A list of all of the objects returned in the connection. This is a convenience
   * field provided for quickly exploring the API; rather than querying for
   * "{ edges { node } }" when no edge data is needed, this field can be be used
   * instead. Note that when clients like Relay need to fetch the "cursor" field on
   * the edge to enable efficient pagination, this shortcut cannot be used, and the
   * full "{ edges { node } }" version should be used instead.
   */
  starships?: Maybe<Array<Maybe<Starship>>>;
  /**
   * A count of the total number of objects in this connection, ignoring pagination.
   * This allows a client to fetch the first five objects by passing "5" as the
   * argument to "first", then fetch the total count so it could display "5 of 83",
   * for example.
   */
  totalCount?: Maybe<Scalars['Int']>;
};

/** An edge in a connection. */
export type StarshipsEdge = {
  __typename?: 'StarshipsEdge';
  /** A cursor for use in pagination */
  cursor: Scalars['String'];
  /** The item at the end of the edge */
  node?: Maybe<Starship>;
};

/** A single transport craft that does not have hyperdrive capability */
export type Vehicle = Node & {
  __typename?: 'Vehicle';
  /** The maximum number of kilograms that this vehicle can transport. */
  cargoCapacity?: Maybe<Scalars['Float']>;
  /**
   * The maximum length of time that this vehicle can provide consumables for its
   * entire crew without having to resupply.
   */
  consumables?: Maybe<Scalars['String']>;
  /** The cost of this vehicle new, in Galactic Credits. */
  costInCredits?: Maybe<Scalars['Float']>;
  /** The ISO 8601 date format of the time that this resource was created. */
  created?: Maybe<Scalars['String']>;
  /** The number of personnel needed to run or pilot this vehicle. */
  crew?: Maybe<Scalars['String']>;
  /** The ISO 8601 date format of the time that this resource was edited. */
  edited?: Maybe<Scalars['String']>;
  filmConnection?: Maybe<VehicleFilmsConnection>;
  /** The ID of an object */
  id: Scalars['ID'];
  /** The length of this vehicle in meters. */
  length?: Maybe<Scalars['Float']>;
  /** The manufacturers of this vehicle. */
  manufacturers?: Maybe<Array<Maybe<Scalars['String']>>>;
  /** The maximum speed of this vehicle in atmosphere. */
  maxAtmospheringSpeed?: Maybe<Scalars['Int']>;
  /**
   * The model or official name of this vehicle. Such as "All-Terrain Attack
   * Transport".
   */
  model?: Maybe<Scalars['String']>;
  /**
   * The name of this vehicle. The common name, such as "Sand Crawler" or "Speeder
   * bike".
   */
  name?: Maybe<Scalars['String']>;
  /** The number of non-essential people this vehicle can transport. */
  passengers?: Maybe<Scalars['String']>;
  pilotConnection?: Maybe<VehiclePilotsConnection>;
  /** The class of this vehicle, such as "Wheeled" or "Repulsorcraft". */
  vehicleClass?: Maybe<Scalars['String']>;
};


/** A single transport craft that does not have hyperdrive capability */
export type Vehicle_FilmConnectionArgs = {
  after?: InputMaybe<Scalars['String']>;
  before?: InputMaybe<Scalars['String']>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
};


/** A single transport craft that does not have hyperdrive capability */
export type Vehicle_PilotConnectionArgs = {
  after?: InputMaybe<Scalars['String']>;
  before?: InputMaybe<Scalars['String']>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
};

/** A connection to a list of items. */
export type VehicleFilmsConnection = {
  __typename?: 'VehicleFilmsConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<VehicleFilmsEdge>>>;
  /**
   * A list of all of the objects returned in the connection. This is a convenience
   * field provided for quickly exploring the API; rather than querying for
   * "{ edges { node } }" when no edge data is needed, this field can be be used
   * instead. Note that when clients like Relay need to fetch the "cursor" field on
   * the edge to enable efficient pagination, this shortcut cannot be used, and the
   * full "{ edges { node } }" version should be used instead.
   */
  films?: Maybe<Array<Maybe<Film>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /**
   * A count of the total number of objects in this connection, ignoring pagination.
   * This allows a client to fetch the first five objects by passing "5" as the
   * argument to "first", then fetch the total count so it could display "5 of 83",
   * for example.
   */
  totalCount?: Maybe<Scalars['Int']>;
};

/** An edge in a connection. */
export type VehicleFilmsEdge = {
  __typename?: 'VehicleFilmsEdge';
  /** A cursor for use in pagination */
  cursor: Scalars['String'];
  /** The item at the end of the edge */
  node?: Maybe<Film>;
};

/** A connection to a list of items. */
export type VehiclePilotsConnection = {
  __typename?: 'VehiclePilotsConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<VehiclePilotsEdge>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /**
   * A list of all of the objects returned in the connection. This is a convenience
   * field provided for quickly exploring the API; rather than querying for
   * "{ edges { node } }" when no edge data is needed, this field can be be used
   * instead. Note that when clients like Relay need to fetch the "cursor" field on
   * the edge to enable efficient pagination, this shortcut cannot be used, and the
   * full "{ edges { node } }" version should be used instead.
   */
  pilots?: Maybe<Array<Maybe<Person>>>;
  /**
   * A count of the total number of objects in this connection, ignoring pagination.
   * This allows a client to fetch the first five objects by passing "5" as the
   * argument to "first", then fetch the total count so it could display "5 of 83",
   * for example.
   */
  totalCount?: Maybe<Scalars['Int']>;
};

/** An edge in a connection. */
export type VehiclePilotsEdge = {
  __typename?: 'VehiclePilotsEdge';
  /** A cursor for use in pagination */
  cursor: Scalars['String'];
  /** The item at the end of the edge */
  node?: Maybe<Person>;
};

/** A connection to a list of items. */
export type VehiclesConnection = {
  __typename?: 'VehiclesConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<VehiclesEdge>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /**
   * A count of the total number of objects in this connection, ignoring pagination.
   * This allows a client to fetch the first five objects by passing "5" as the
   * argument to "first", then fetch the total count so it could display "5 of 83",
   * for example.
   */
  totalCount?: Maybe<Scalars['Int']>;
  /**
   * A list of all of the objects returned in the connection. This is a convenience
   * field provided for quickly exploring the API; rather than querying for
   * "{ edges { node } }" when no edge data is needed, this field can be be used
   * instead. Note that when clients like Relay need to fetch the "cursor" field on
   * the edge to enable efficient pagination, this shortcut cannot be used, and the
   * full "{ edges { node } }" version should be used instead.
   */
  vehicles?: Maybe<Array<Maybe<Vehicle>>>;
};

/** An edge in a connection. */
export type VehiclesEdge = {
  __typename?: 'VehiclesEdge';
  /** A cursor for use in pagination */
  cursor: Scalars['String'];
  /** The item at the end of the edge */
  node?: Maybe<Vehicle>;
};


export default {
  introspection: {
    "__schema": {
      "queryType": {
        "name": "Root"
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
          "name": "Film",
          "fields": [
            {
              "name": "characterConnection",
              "type": {
                "kind": "OBJECT",
                "name": "FilmCharactersConnection",
                "ofType": null
              },
              "args": [
                {
                  "name": "after",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "before",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "first",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                },
                {
                  "name": "last",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "created",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "director",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "edited",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "episodeID",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "id",
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
              "name": "openingCrawl",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "planetConnection",
              "type": {
                "kind": "OBJECT",
                "name": "FilmPlanetsConnection",
                "ofType": null
              },
              "args": [
                {
                  "name": "after",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "before",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "first",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                },
                {
                  "name": "last",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "producers",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "SCALAR",
                  "name": "String",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "releaseDate",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "speciesConnection",
              "type": {
                "kind": "OBJECT",
                "name": "FilmSpeciesConnection",
                "ofType": null
              },
              "args": [
                {
                  "name": "after",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "before",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "first",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                },
                {
                  "name": "last",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "starshipConnection",
              "type": {
                "kind": "OBJECT",
                "name": "FilmStarshipsConnection",
                "ofType": null
              },
              "args": [
                {
                  "name": "after",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "before",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "first",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                },
                {
                  "name": "last",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "title",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "vehicleConnection",
              "type": {
                "kind": "OBJECT",
                "name": "FilmVehiclesConnection",
                "ofType": null
              },
              "args": [
                {
                  "name": "after",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "before",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "first",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                },
                {
                  "name": "last",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                }
              ]
            }
          ],
          "interfaces": [
            {
              "kind": "INTERFACE",
              "name": "Node"
            }
          ]
        },
        {
          "kind": "OBJECT",
          "name": "FilmCharactersConnection",
          "fields": [
            {
              "name": "characters",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Person",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "edges",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "FilmCharactersEdge",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "pageInfo",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PageInfo",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "totalCount",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "FilmCharactersEdge",
          "fields": [
            {
              "name": "cursor",
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
              "name": "node",
              "type": {
                "kind": "OBJECT",
                "name": "Person",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "FilmPlanetsConnection",
          "fields": [
            {
              "name": "edges",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "FilmPlanetsEdge",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "pageInfo",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PageInfo",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "planets",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Planet",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "totalCount",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "FilmPlanetsEdge",
          "fields": [
            {
              "name": "cursor",
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
              "name": "node",
              "type": {
                "kind": "OBJECT",
                "name": "Planet",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "FilmSpeciesConnection",
          "fields": [
            {
              "name": "edges",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "FilmSpeciesEdge",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "pageInfo",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PageInfo",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "species",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Species",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "totalCount",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "FilmSpeciesEdge",
          "fields": [
            {
              "name": "cursor",
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
              "name": "node",
              "type": {
                "kind": "OBJECT",
                "name": "Species",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "FilmStarshipsConnection",
          "fields": [
            {
              "name": "edges",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "FilmStarshipsEdge",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "pageInfo",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PageInfo",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "starships",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Starship",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "totalCount",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "FilmStarshipsEdge",
          "fields": [
            {
              "name": "cursor",
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
              "name": "node",
              "type": {
                "kind": "OBJECT",
                "name": "Starship",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "FilmVehiclesConnection",
          "fields": [
            {
              "name": "edges",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "FilmVehiclesEdge",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "pageInfo",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PageInfo",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "totalCount",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "vehicles",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Vehicle",
                  "ofType": null
                }
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "FilmVehiclesEdge",
          "fields": [
            {
              "name": "cursor",
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
              "name": "node",
              "type": {
                "kind": "OBJECT",
                "name": "Vehicle",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "FilmsConnection",
          "fields": [
            {
              "name": "edges",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "FilmsEdge",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "films",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Film",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "pageInfo",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PageInfo",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "totalCount",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "FilmsEdge",
          "fields": [
            {
              "name": "cursor",
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
              "name": "node",
              "type": {
                "kind": "OBJECT",
                "name": "Film",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "SCALAR",
          "name": "Float"
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
          "name": "Node",
          "fields": [
            {
              "name": "id",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "SCALAR",
                  "name": "ID",
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
              "name": "Film"
            },
            {
              "kind": "OBJECT",
              "name": "Person"
            },
            {
              "kind": "OBJECT",
              "name": "Planet"
            },
            {
              "kind": "OBJECT",
              "name": "Species"
            },
            {
              "kind": "OBJECT",
              "name": "Starship"
            },
            {
              "kind": "OBJECT",
              "name": "Vehicle"
            }
          ]
        },
        {
          "kind": "OBJECT",
          "name": "PageInfo",
          "fields": [
            {
              "name": "endCursor",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "hasNextPage",
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
              "name": "hasPreviousPage",
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
              "name": "startCursor",
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
          "kind": "OBJECT",
          "name": "PeopleConnection",
          "fields": [
            {
              "name": "edges",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PeopleEdge",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "pageInfo",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PageInfo",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "people",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Person",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "totalCount",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "PeopleEdge",
          "fields": [
            {
              "name": "cursor",
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
              "name": "node",
              "type": {
                "kind": "OBJECT",
                "name": "Person",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "Person",
          "fields": [
            {
              "name": "birthYear",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "created",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "edited",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "eyeColor",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "filmConnection",
              "type": {
                "kind": "OBJECT",
                "name": "PersonFilmsConnection",
                "ofType": null
              },
              "args": [
                {
                  "name": "after",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "before",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "first",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                },
                {
                  "name": "last",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "gender",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "hairColor",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "height",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "homeworld",
              "type": {
                "kind": "OBJECT",
                "name": "Planet",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "id",
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
              "name": "mass",
              "type": {
                "kind": "SCALAR",
                "name": "Float",
                "ofType": null
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
              "name": "skinColor",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "species",
              "type": {
                "kind": "OBJECT",
                "name": "Species",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "starshipConnection",
              "type": {
                "kind": "OBJECT",
                "name": "PersonStarshipsConnection",
                "ofType": null
              },
              "args": [
                {
                  "name": "after",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "before",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "first",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                },
                {
                  "name": "last",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "vehicleConnection",
              "type": {
                "kind": "OBJECT",
                "name": "PersonVehiclesConnection",
                "ofType": null
              },
              "args": [
                {
                  "name": "after",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "before",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "first",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                },
                {
                  "name": "last",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                }
              ]
            }
          ],
          "interfaces": [
            {
              "kind": "INTERFACE",
              "name": "Node"
            }
          ]
        },
        {
          "kind": "OBJECT",
          "name": "PersonFilmsConnection",
          "fields": [
            {
              "name": "edges",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PersonFilmsEdge",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "films",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Film",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "pageInfo",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PageInfo",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "totalCount",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "PersonFilmsEdge",
          "fields": [
            {
              "name": "cursor",
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
              "name": "node",
              "type": {
                "kind": "OBJECT",
                "name": "Film",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "PersonStarshipsConnection",
          "fields": [
            {
              "name": "edges",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PersonStarshipsEdge",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "pageInfo",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PageInfo",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "starships",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Starship",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "totalCount",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "PersonStarshipsEdge",
          "fields": [
            {
              "name": "cursor",
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
              "name": "node",
              "type": {
                "kind": "OBJECT",
                "name": "Starship",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "PersonVehiclesConnection",
          "fields": [
            {
              "name": "edges",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PersonVehiclesEdge",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "pageInfo",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PageInfo",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "totalCount",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "vehicles",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Vehicle",
                  "ofType": null
                }
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "PersonVehiclesEdge",
          "fields": [
            {
              "name": "cursor",
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
              "name": "node",
              "type": {
                "kind": "OBJECT",
                "name": "Vehicle",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "Planet",
          "fields": [
            {
              "name": "climates",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "SCALAR",
                  "name": "String",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "created",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "diameter",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "edited",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "filmConnection",
              "type": {
                "kind": "OBJECT",
                "name": "PlanetFilmsConnection",
                "ofType": null
              },
              "args": [
                {
                  "name": "after",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "before",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "first",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                },
                {
                  "name": "last",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "gravity",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "id",
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
              "name": "orbitalPeriod",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "population",
              "type": {
                "kind": "SCALAR",
                "name": "Float",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "residentConnection",
              "type": {
                "kind": "OBJECT",
                "name": "PlanetResidentsConnection",
                "ofType": null
              },
              "args": [
                {
                  "name": "after",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "before",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "first",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                },
                {
                  "name": "last",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "rotationPeriod",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "surfaceWater",
              "type": {
                "kind": "SCALAR",
                "name": "Float",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "terrains",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "SCALAR",
                  "name": "String",
                  "ofType": null
                }
              },
              "args": []
            }
          ],
          "interfaces": [
            {
              "kind": "INTERFACE",
              "name": "Node"
            }
          ]
        },
        {
          "kind": "OBJECT",
          "name": "PlanetFilmsConnection",
          "fields": [
            {
              "name": "edges",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PlanetFilmsEdge",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "films",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Film",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "pageInfo",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PageInfo",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "totalCount",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "PlanetFilmsEdge",
          "fields": [
            {
              "name": "cursor",
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
              "name": "node",
              "type": {
                "kind": "OBJECT",
                "name": "Film",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "PlanetResidentsConnection",
          "fields": [
            {
              "name": "edges",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PlanetResidentsEdge",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "pageInfo",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PageInfo",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "residents",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Person",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "totalCount",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "PlanetResidentsEdge",
          "fields": [
            {
              "name": "cursor",
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
              "name": "node",
              "type": {
                "kind": "OBJECT",
                "name": "Person",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "PlanetsConnection",
          "fields": [
            {
              "name": "edges",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PlanetsEdge",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "pageInfo",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PageInfo",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "planets",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Planet",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "totalCount",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "PlanetsEdge",
          "fields": [
            {
              "name": "cursor",
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
              "name": "node",
              "type": {
                "kind": "OBJECT",
                "name": "Planet",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "Root",
          "fields": [
            {
              "name": "allFilms",
              "type": {
                "kind": "OBJECT",
                "name": "FilmsConnection",
                "ofType": null
              },
              "args": [
                {
                  "name": "after",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "before",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "first",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                },
                {
                  "name": "last",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "allPeople",
              "type": {
                "kind": "OBJECT",
                "name": "PeopleConnection",
                "ofType": null
              },
              "args": [
                {
                  "name": "after",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "before",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "first",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                },
                {
                  "name": "last",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "allPlanets",
              "type": {
                "kind": "OBJECT",
                "name": "PlanetsConnection",
                "ofType": null
              },
              "args": [
                {
                  "name": "after",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "before",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "first",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                },
                {
                  "name": "last",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "allSpecies",
              "type": {
                "kind": "OBJECT",
                "name": "SpeciesConnection",
                "ofType": null
              },
              "args": [
                {
                  "name": "after",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "before",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "first",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                },
                {
                  "name": "last",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "allStarships",
              "type": {
                "kind": "OBJECT",
                "name": "StarshipsConnection",
                "ofType": null
              },
              "args": [
                {
                  "name": "after",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "before",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "first",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                },
                {
                  "name": "last",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "allVehicles",
              "type": {
                "kind": "OBJECT",
                "name": "VehiclesConnection",
                "ofType": null
              },
              "args": [
                {
                  "name": "after",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "before",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "first",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                },
                {
                  "name": "last",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "film",
              "type": {
                "kind": "OBJECT",
                "name": "Film",
                "ofType": null
              },
              "args": [
                {
                  "name": "filmID",
                  "type": {
                    "kind": "SCALAR",
                    "name": "ID",
                    "ofType": null
                  }
                },
                {
                  "name": "id",
                  "type": {
                    "kind": "SCALAR",
                    "name": "ID",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "node",
              "type": {
                "kind": "INTERFACE",
                "name": "Node",
                "ofType": null
              },
              "args": [
                {
                  "name": "id",
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
              "name": "person",
              "type": {
                "kind": "OBJECT",
                "name": "Person",
                "ofType": null
              },
              "args": [
                {
                  "name": "id",
                  "type": {
                    "kind": "SCALAR",
                    "name": "ID",
                    "ofType": null
                  }
                },
                {
                  "name": "personID",
                  "type": {
                    "kind": "SCALAR",
                    "name": "ID",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "planet",
              "type": {
                "kind": "OBJECT",
                "name": "Planet",
                "ofType": null
              },
              "args": [
                {
                  "name": "id",
                  "type": {
                    "kind": "SCALAR",
                    "name": "ID",
                    "ofType": null
                  }
                },
                {
                  "name": "planetID",
                  "type": {
                    "kind": "SCALAR",
                    "name": "ID",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "species",
              "type": {
                "kind": "OBJECT",
                "name": "Species",
                "ofType": null
              },
              "args": [
                {
                  "name": "id",
                  "type": {
                    "kind": "SCALAR",
                    "name": "ID",
                    "ofType": null
                  }
                },
                {
                  "name": "speciesID",
                  "type": {
                    "kind": "SCALAR",
                    "name": "ID",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "starship",
              "type": {
                "kind": "OBJECT",
                "name": "Starship",
                "ofType": null
              },
              "args": [
                {
                  "name": "id",
                  "type": {
                    "kind": "SCALAR",
                    "name": "ID",
                    "ofType": null
                  }
                },
                {
                  "name": "starshipID",
                  "type": {
                    "kind": "SCALAR",
                    "name": "ID",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "vehicle",
              "type": {
                "kind": "OBJECT",
                "name": "Vehicle",
                "ofType": null
              },
              "args": [
                {
                  "name": "id",
                  "type": {
                    "kind": "SCALAR",
                    "name": "ID",
                    "ofType": null
                  }
                },
                {
                  "name": "vehicleID",
                  "type": {
                    "kind": "SCALAR",
                    "name": "ID",
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
          "name": "Species",
          "fields": [
            {
              "name": "averageHeight",
              "type": {
                "kind": "SCALAR",
                "name": "Float",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "averageLifespan",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "classification",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "created",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "designation",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "edited",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "eyeColors",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "SCALAR",
                  "name": "String",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "filmConnection",
              "type": {
                "kind": "OBJECT",
                "name": "SpeciesFilmsConnection",
                "ofType": null
              },
              "args": [
                {
                  "name": "after",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "before",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "first",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                },
                {
                  "name": "last",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "hairColors",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "SCALAR",
                  "name": "String",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "homeworld",
              "type": {
                "kind": "OBJECT",
                "name": "Planet",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "id",
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
              "name": "language",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
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
              "name": "personConnection",
              "type": {
                "kind": "OBJECT",
                "name": "SpeciesPeopleConnection",
                "ofType": null
              },
              "args": [
                {
                  "name": "after",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "before",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "first",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                },
                {
                  "name": "last",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "skinColors",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "SCALAR",
                  "name": "String",
                  "ofType": null
                }
              },
              "args": []
            }
          ],
          "interfaces": [
            {
              "kind": "INTERFACE",
              "name": "Node"
            }
          ]
        },
        {
          "kind": "OBJECT",
          "name": "SpeciesConnection",
          "fields": [
            {
              "name": "edges",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "SpeciesEdge",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "pageInfo",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PageInfo",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "species",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Species",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "totalCount",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "SpeciesEdge",
          "fields": [
            {
              "name": "cursor",
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
              "name": "node",
              "type": {
                "kind": "OBJECT",
                "name": "Species",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "SpeciesFilmsConnection",
          "fields": [
            {
              "name": "edges",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "SpeciesFilmsEdge",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "films",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Film",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "pageInfo",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PageInfo",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "totalCount",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "SpeciesFilmsEdge",
          "fields": [
            {
              "name": "cursor",
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
              "name": "node",
              "type": {
                "kind": "OBJECT",
                "name": "Film",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "SpeciesPeopleConnection",
          "fields": [
            {
              "name": "edges",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "SpeciesPeopleEdge",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "pageInfo",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PageInfo",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "people",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Person",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "totalCount",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "SpeciesPeopleEdge",
          "fields": [
            {
              "name": "cursor",
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
              "name": "node",
              "type": {
                "kind": "OBJECT",
                "name": "Person",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "Starship",
          "fields": [
            {
              "name": "MGLT",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "cargoCapacity",
              "type": {
                "kind": "SCALAR",
                "name": "Float",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "consumables",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "costInCredits",
              "type": {
                "kind": "SCALAR",
                "name": "Float",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "created",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "crew",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "edited",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "filmConnection",
              "type": {
                "kind": "OBJECT",
                "name": "StarshipFilmsConnection",
                "ofType": null
              },
              "args": [
                {
                  "name": "after",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "before",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "first",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                },
                {
                  "name": "last",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "hyperdriveRating",
              "type": {
                "kind": "SCALAR",
                "name": "Float",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "id",
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
              "name": "length",
              "type": {
                "kind": "SCALAR",
                "name": "Float",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "manufacturers",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "SCALAR",
                  "name": "String",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "maxAtmospheringSpeed",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "model",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
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
              "name": "passengers",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "pilotConnection",
              "type": {
                "kind": "OBJECT",
                "name": "StarshipPilotsConnection",
                "ofType": null
              },
              "args": [
                {
                  "name": "after",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "before",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "first",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                },
                {
                  "name": "last",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "starshipClass",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": [
            {
              "kind": "INTERFACE",
              "name": "Node"
            }
          ]
        },
        {
          "kind": "OBJECT",
          "name": "StarshipFilmsConnection",
          "fields": [
            {
              "name": "edges",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "StarshipFilmsEdge",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "films",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Film",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "pageInfo",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PageInfo",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "totalCount",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "StarshipFilmsEdge",
          "fields": [
            {
              "name": "cursor",
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
              "name": "node",
              "type": {
                "kind": "OBJECT",
                "name": "Film",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "StarshipPilotsConnection",
          "fields": [
            {
              "name": "edges",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "StarshipPilotsEdge",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "pageInfo",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PageInfo",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "pilots",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Person",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "totalCount",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "StarshipPilotsEdge",
          "fields": [
            {
              "name": "cursor",
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
              "name": "node",
              "type": {
                "kind": "OBJECT",
                "name": "Person",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "StarshipsConnection",
          "fields": [
            {
              "name": "edges",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "StarshipsEdge",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "pageInfo",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PageInfo",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "starships",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Starship",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "totalCount",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "StarshipsEdge",
          "fields": [
            {
              "name": "cursor",
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
              "name": "node",
              "type": {
                "kind": "OBJECT",
                "name": "Starship",
                "ofType": null
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
          "kind": "OBJECT",
          "name": "Vehicle",
          "fields": [
            {
              "name": "cargoCapacity",
              "type": {
                "kind": "SCALAR",
                "name": "Float",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "consumables",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "costInCredits",
              "type": {
                "kind": "SCALAR",
                "name": "Float",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "created",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "crew",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "edited",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "filmConnection",
              "type": {
                "kind": "OBJECT",
                "name": "VehicleFilmsConnection",
                "ofType": null
              },
              "args": [
                {
                  "name": "after",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "before",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "first",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                },
                {
                  "name": "last",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "id",
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
              "name": "length",
              "type": {
                "kind": "SCALAR",
                "name": "Float",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "manufacturers",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "SCALAR",
                  "name": "String",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "maxAtmospheringSpeed",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "model",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
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
              "name": "passengers",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "pilotConnection",
              "type": {
                "kind": "OBJECT",
                "name": "VehiclePilotsConnection",
                "ofType": null
              },
              "args": [
                {
                  "name": "after",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "before",
                  "type": {
                    "kind": "SCALAR",
                    "name": "String",
                    "ofType": null
                  }
                },
                {
                  "name": "first",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                },
                {
                  "name": "last",
                  "type": {
                    "kind": "SCALAR",
                    "name": "Int",
                    "ofType": null
                  }
                }
              ]
            },
            {
              "name": "vehicleClass",
              "type": {
                "kind": "SCALAR",
                "name": "String",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": [
            {
              "kind": "INTERFACE",
              "name": "Node"
            }
          ]
        },
        {
          "kind": "OBJECT",
          "name": "VehicleFilmsConnection",
          "fields": [
            {
              "name": "edges",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "VehicleFilmsEdge",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "films",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Film",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "pageInfo",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PageInfo",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "totalCount",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "VehicleFilmsEdge",
          "fields": [
            {
              "name": "cursor",
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
              "name": "node",
              "type": {
                "kind": "OBJECT",
                "name": "Film",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "VehiclePilotsConnection",
          "fields": [
            {
              "name": "edges",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "VehiclePilotsEdge",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "pageInfo",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PageInfo",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "pilots",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Person",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "totalCount",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "VehiclePilotsEdge",
          "fields": [
            {
              "name": "cursor",
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
              "name": "node",
              "type": {
                "kind": "OBJECT",
                "name": "Person",
                "ofType": null
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "VehiclesConnection",
          "fields": [
            {
              "name": "edges",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "VehiclesEdge",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "pageInfo",
              "type": {
                "kind": "NON_NULL",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "PageInfo",
                  "ofType": null
                }
              },
              "args": []
            },
            {
              "name": "totalCount",
              "type": {
                "kind": "SCALAR",
                "name": "Int",
                "ofType": null
              },
              "args": []
            },
            {
              "name": "vehicles",
              "type": {
                "kind": "LIST",
                "ofType": {
                  "kind": "OBJECT",
                  "name": "Vehicle",
                  "ofType": null
                }
              },
              "args": []
            }
          ],
          "interfaces": []
        },
        {
          "kind": "OBJECT",
          "name": "VehiclesEdge",
          "fields": [
            {
              "name": "cursor",
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
              "name": "node",
              "type": {
                "kind": "OBJECT",
                "name": "Vehicle",
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
    Film: Film,
    Film_CharacterConnectionArgs: Film_CharacterConnectionArgs,
    Film_PlanetConnectionArgs: Film_PlanetConnectionArgs,
    Film_SpeciesConnectionArgs: Film_SpeciesConnectionArgs,
    Film_StarshipConnectionArgs: Film_StarshipConnectionArgs,
    Film_VehicleConnectionArgs: Film_VehicleConnectionArgs,
    FilmCharactersConnection: FilmCharactersConnection,
    FilmCharactersEdge: FilmCharactersEdge,
    FilmPlanetsConnection: FilmPlanetsConnection,
    FilmPlanetsEdge: FilmPlanetsEdge,
    FilmSpeciesConnection: FilmSpeciesConnection,
    FilmSpeciesEdge: FilmSpeciesEdge,
    FilmStarshipsConnection: FilmStarshipsConnection,
    FilmStarshipsEdge: FilmStarshipsEdge,
    FilmVehiclesConnection: FilmVehiclesConnection,
    FilmVehiclesEdge: FilmVehiclesEdge,
    FilmsConnection: FilmsConnection,
    FilmsEdge: FilmsEdge,
    Node: Node,
    PageInfo: PageInfo,
    PeopleConnection: PeopleConnection,
    PeopleEdge: PeopleEdge,
    Person: Person,
    Person_FilmConnectionArgs: Person_FilmConnectionArgs,
    Person_StarshipConnectionArgs: Person_StarshipConnectionArgs,
    Person_VehicleConnectionArgs: Person_VehicleConnectionArgs,
    PersonFilmsConnection: PersonFilmsConnection,
    PersonFilmsEdge: PersonFilmsEdge,
    PersonStarshipsConnection: PersonStarshipsConnection,
    PersonStarshipsEdge: PersonStarshipsEdge,
    PersonVehiclesConnection: PersonVehiclesConnection,
    PersonVehiclesEdge: PersonVehiclesEdge,
    Planet: Planet,
    Planet_FilmConnectionArgs: Planet_FilmConnectionArgs,
    Planet_ResidentConnectionArgs: Planet_ResidentConnectionArgs,
    PlanetFilmsConnection: PlanetFilmsConnection,
    PlanetFilmsEdge: PlanetFilmsEdge,
    PlanetResidentsConnection: PlanetResidentsConnection,
    PlanetResidentsEdge: PlanetResidentsEdge,
    PlanetsConnection: PlanetsConnection,
    PlanetsEdge: PlanetsEdge,
    Root: Root,
    Root_AllFilmsArgs: Root_AllFilmsArgs,
    Root_AllPeopleArgs: Root_AllPeopleArgs,
    Root_AllPlanetsArgs: Root_AllPlanetsArgs,
    Root_AllSpeciesArgs: Root_AllSpeciesArgs,
    Root_AllStarshipsArgs: Root_AllStarshipsArgs,
    Root_AllVehiclesArgs: Root_AllVehiclesArgs,
    Root_FilmArgs: Root_FilmArgs,
    Root_NodeArgs: Root_NodeArgs,
    Root_PersonArgs: Root_PersonArgs,
    Root_PlanetArgs: Root_PlanetArgs,
    Root_SpeciesArgs: Root_SpeciesArgs,
    Root_StarshipArgs: Root_StarshipArgs,
    Root_VehicleArgs: Root_VehicleArgs,
    Species: Species,
    Species_FilmConnectionArgs: Species_FilmConnectionArgs,
    Species_PersonConnectionArgs: Species_PersonConnectionArgs,
    SpeciesConnection: SpeciesConnection,
    SpeciesEdge: SpeciesEdge,
    SpeciesFilmsConnection: SpeciesFilmsConnection,
    SpeciesFilmsEdge: SpeciesFilmsEdge,
    SpeciesPeopleConnection: SpeciesPeopleConnection,
    SpeciesPeopleEdge: SpeciesPeopleEdge,
    Starship: Starship,
    Starship_FilmConnectionArgs: Starship_FilmConnectionArgs,
    Starship_PilotConnectionArgs: Starship_PilotConnectionArgs,
    StarshipFilmsConnection: StarshipFilmsConnection,
    StarshipFilmsEdge: StarshipFilmsEdge,
    StarshipPilotsConnection: StarshipPilotsConnection,
    StarshipPilotsEdge: StarshipPilotsEdge,
    StarshipsConnection: StarshipsConnection,
    StarshipsEdge: StarshipsEdge,
    Vehicle: Vehicle,
    Vehicle_FilmConnectionArgs: Vehicle_FilmConnectionArgs,
    Vehicle_PilotConnectionArgs: Vehicle_PilotConnectionArgs,
    VehicleFilmsConnection: VehicleFilmsConnection,
    VehicleFilmsEdge: VehicleFilmsEdge,
    VehiclePilotsConnection: VehiclePilotsConnection,
    VehiclePilotsEdge: VehiclePilotsEdge,
    VehiclesConnection: VehiclesConnection,
    VehiclesEdge: VehiclesEdge
  }
}