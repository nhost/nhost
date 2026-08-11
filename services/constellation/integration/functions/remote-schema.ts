import type { Request, Response } from "express";
import { createSchema, createYoga } from "graphql-yoga";

// Teams mapped to departments (from seeds)
const teams = [
  {
    id: "team-hr",
    name: "HR United",
    departmentId: "2db9de0a-b9ba-416e-8619-783a399ae2b3",
    departmentName: "Human Resources",
  },
  {
    id: "team-eng",
    name: "Engineering FC",
    departmentId: "023d4410-715e-4675-96a5-a58fd50ef33c",
    departmentName: "Engineering",
  },
  {
    id: "team-mkt",
    name: "Marketing Rovers",
    departmentId: "dcd52518-58d0-4834-9683-ba6dee33833f",
    departmentName: "Marketing",
  },
  {
    id: "team-sales",
    name: "Sales Strikers",
    departmentId: "ffd095c2-9745-43d9-b133-7e8d847e8371",
    departmentName: "Sales",
  },
  {
    id: "team-fin",
    name: "Finance Athletic",
    departmentId: "24e9b8db-acf8-439f-9d63-7f83de523fb3",
    departmentName: "Finance",
  },
  {
    id: "team-ops",
    name: "Operations City",
    departmentId: "fd1e6bba-c292-4b2f-872e-ae16146cdd82",
    departmentName: "Operations",
  },
];

// In-memory storage for games
interface Game {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  playedAt: string;
  source: string;
}

const games: Game[] = [];
let gameIdCounter = 1;

const typeDefs = `
  type Team {
    id: ID!
    name: String!
    departmentId: ID!
    departmentName: String!
    gamesPlayed: Int!
    wins: Int!
    draws: Int!
    losses: Int!
    goalsFor: Int!
    goalsAgainst: Int!
    goalDifference: Int!
    points: Int!
  }

  type Game {
    id: ID!
    homeTeam: Team!
    awayTeam: Team!
    homeScore: Int!
    awayScore: Int!
    playedAt: String!
    source: String!
  }

  type Query {
    teams: [Team!]!
    team(id: ID!): Team
    teamByDepartment(departmentId: ID!): Team
    games: [Game!]!
    game(id: ID!): Game
    leaderboard: [Team!]!

    """
    Get games for a specific team.
    Use case: preset teamId with a fixed value per role (e.g., hr_manager only sees HR United games)
    """
    teamGames(teamId: ID!): [Game!]!

    """
    Get the user's team.
    Use case: preset teamId with X-Hasura-Team-Id session variable
    """
    myTeam(teamId: ID!): Team

    """
    Get a team by department with optional stats filtering.
    Use case: departmentId is the join arg (bound by metadata); includeStats is user-provided.
    When includeStats is false, all stats are zeroed out.
    When omitted or true, normal stats are returned.
    """
    teamByDepartmentFiltered(departmentId: ID!, includeStats: Boolean): Team
  }

  input RecordGameInput {
    homeTeamId: ID!
    awayTeamId: ID!
    homeScore: Int!
    awayScore: Int!
  }

  type Mutation {
    recordGame(input: RecordGameInput!): Game!

    """
    Record a game for the user's team.
    Use case: preset teamId with X-Hasura-Team-Id session variable
    """
    recordMyTeamGame(teamId: ID!, opponentId: ID!, teamScore: Int!, opponentScore: Int!, isHome: Boolean!): Game!

    """
    Report a game result with a source.
    Use case: preset source with a fixed value per role
    - "official" for league_admin role
    - "user_reported" for user role
    """
    reportGame(homeTeamId: ID!, awayTeamId: ID!, homeScore: Int!, awayScore: Int!, source: String!): Game!

    resetLeague: Boolean!
  }
`;

function getTeamStats(teamId: string) {
  const team = teams.find((t) => t.id === teamId);
  if (!team) return null;

  let wins = 0,
    draws = 0,
    losses = 0,
    goalsFor = 0,
    goalsAgainst = 0;

  for (const game of games) {
    if (game.homeTeamId === teamId) {
      goalsFor += game.homeScore;
      goalsAgainst += game.awayScore;
      if (game.homeScore > game.awayScore) wins++;
      else if (game.homeScore === game.awayScore) draws++;
      else losses++;
    } else if (game.awayTeamId === teamId) {
      goalsFor += game.awayScore;
      goalsAgainst += game.homeScore;
      if (game.awayScore > game.homeScore) wins++;
      else if (game.awayScore === game.homeScore) draws++;
      else losses++;
    }
  }

  return {
    ...team,
    gamesPlayed: wins + draws + losses,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    points: wins * 3 + draws,
  };
}

const resolvers = {
  Query: {
    teams: () => teams.map((t) => getTeamStats(t.id)),
    team: (_: unknown, { id }: { id: string }) => getTeamStats(id),
    teamByDepartment: (_: unknown, { departmentId }: { departmentId: string }) => {
      const team = teams.find((t) => t.departmentId === departmentId);
      return team ? getTeamStats(team.id) : null;
    },
    games: () =>
      games.map((g) => ({
        ...g,
        homeTeam: getTeamStats(g.homeTeamId),
        awayTeam: getTeamStats(g.awayTeamId),
      })),
    game: (_: unknown, { id }: { id: string }) => {
      const game = games.find((g) => g.id === id);
      if (!game) return null;
      return {
        ...game,
        homeTeam: getTeamStats(game.homeTeamId),
        awayTeam: getTeamStats(game.awayTeamId),
      };
    },
    leaderboard: () => {
      const allTeams = teams.map((t) => getTeamStats(t.id)!);
      return allTeams.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference)
          return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
      });
    },
    // For fixed value preset: each role sees only their team's games
    teamGames: (_: unknown, { teamId }: { teamId: string }) => {
      return games
        .filter((g) => g.homeTeamId === teamId || g.awayTeamId === teamId)
        .map((g) => ({
          ...g,
          homeTeam: getTeamStats(g.homeTeamId),
          awayTeam: getTeamStats(g.awayTeamId),
        }));
    },
    // For session variable preset: X-Hasura-Team-Id -> teamId
    myTeam: (_: unknown, { teamId }: { teamId: string }) => {
      return getTeamStats(teamId);
    },
    // For testing user-provided argument forwarding on remote relationships
    teamByDepartmentFiltered: (
      _: unknown,
      { departmentId, includeStats }: { departmentId: string; includeStats?: boolean }
    ) => {
      const team = teams.find((t) => t.departmentId === departmentId);
      if (!team) return null;
      const stats = getTeamStats(team.id);
      if (!stats) return null;
      if (includeStats === false) {
        return {
          ...stats,
          gamesPlayed: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          points: 0,
        };
      }
      return stats;
    },
  },
  Mutation: {
    recordGame: (
      _: unknown,
      {
        input,
      }: {
        input: {
          homeTeamId: string;
          awayTeamId: string;
          homeScore: number;
          awayScore: number;
        };
      }
    ) => {
      const homeTeam = teams.find((t) => t.id === input.homeTeamId);
      const awayTeam = teams.find((t) => t.id === input.awayTeamId);

      if (!homeTeam) {
        throw new Error(`Home team not found: ${input.homeTeamId}`);
      }
      if (!awayTeam) {
        throw new Error(`Away team not found: ${input.awayTeamId}`);
      }
      if (input.homeTeamId === input.awayTeamId) {
        throw new Error("A team cannot play against itself");
      }
      if (input.homeScore < 0 || input.awayScore < 0) {
        throw new Error("Scores cannot be negative");
      }

      const game: Game = {
        id: `game-${gameIdCounter++}`,
        homeTeamId: input.homeTeamId,
        awayTeamId: input.awayTeamId,
        homeScore: input.homeScore,
        awayScore: input.awayScore,
        playedAt: new Date().toISOString(),
        source: "admin",
      };

      games.push(game);

      return {
        ...game,
        homeTeam: getTeamStats(game.homeTeamId),
        awayTeam: getTeamStats(game.awayTeamId),
      };
    },
    // For session variable preset: X-Hasura-Team-Id -> teamId
    recordMyTeamGame: (
      _: unknown,
      {
        teamId,
        opponentId,
        teamScore,
        opponentScore,
        isHome,
      }: {
        teamId: string;
        opponentId: string;
        teamScore: number;
        opponentScore: number;
        isHome: boolean;
      }
    ) => {
      const myTeam = teams.find((t) => t.id === teamId);
      const opponent = teams.find((t) => t.id === opponentId);

      if (!myTeam) {
        throw new Error(`Team not found: ${teamId}`);
      }
      if (!opponent) {
        throw new Error(`Opponent not found: ${opponentId}`);
      }
      if (teamId === opponentId) {
        throw new Error("A team cannot play against itself");
      }
      if (teamScore < 0 || opponentScore < 0) {
        throw new Error("Scores cannot be negative");
      }

      const game: Game = {
        id: `game-${gameIdCounter++}`,
        homeTeamId: isHome ? teamId : opponentId,
        awayTeamId: isHome ? opponentId : teamId,
        homeScore: isHome ? teamScore : opponentScore,
        awayScore: isHome ? opponentScore : teamScore,
        playedAt: new Date().toISOString(),
        source: "team_reported",
      };

      games.push(game);

      return {
        ...game,
        homeTeam: getTeamStats(game.homeTeamId),
        awayTeam: getTeamStats(game.awayTeamId),
      };
    },
    // For fixed value preset: source is preset per role
    reportGame: (
      _: unknown,
      {
        homeTeamId,
        awayTeamId,
        homeScore,
        awayScore,
        source,
      }: {
        homeTeamId: string;
        awayTeamId: string;
        homeScore: number;
        awayScore: number;
        source: string;
      }
    ) => {
      const homeTeam = teams.find((t) => t.id === homeTeamId);
      const awayTeam = teams.find((t) => t.id === awayTeamId);

      if (!homeTeam) {
        throw new Error(`Home team not found: ${homeTeamId}`);
      }
      if (!awayTeam) {
        throw new Error(`Away team not found: ${awayTeamId}`);
      }
      if (homeTeamId === awayTeamId) {
        throw new Error("A team cannot play against itself");
      }
      if (homeScore < 0 || awayScore < 0) {
        throw new Error("Scores cannot be negative");
      }

      const game: Game = {
        id: `game-${gameIdCounter++}`,
        homeTeamId,
        awayTeamId,
        homeScore,
        awayScore,
        playedAt: new Date().toISOString(),
        source,
      };

      games.push(game);

      return {
        ...game,
        homeTeam: getTeamStats(game.homeTeamId),
        awayTeam: getTeamStats(game.awayTeamId),
      };
    },
    resetLeague: () => {
      games.length = 0;
      gameIdCounter = 1;
      return true;
    },
  },
};

const schema = createSchema({ typeDefs, resolvers });

const yoga = createYoga({
  schema,
  graphqlEndpoint: "*",
});

export default async function handler(req: Request, res: Response) {
  const webhookSecret = req.get("x-nhost-webhook-secret");
  if (webhookSecret !== process.env.NHOST_WEBHOOK_SECRET) {
    res.status(401).send("Unauthorized");
    return;
  }

  const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

  const response = await yoga.fetch(url, {
    method: req.method,
    headers: req.headers as HeadersInit,
    body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
  });

  res.status(response.status);
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  const body = await response.text();
  res.send(body);
}
