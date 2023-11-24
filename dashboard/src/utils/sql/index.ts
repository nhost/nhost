// The parsing was inspired by code from the hasura/graphql-engine repo

export interface ParsedSQLEntity {
  type: string;
  name: string;
  schema: string;
}

const sanitizeValue = (value: string) => {
  let val = value;

  if (!/^".*"$/.test(value)) {
    val = value?.toLowerCase() ?? '';
  }

  return val.replace(/['"]+/g, '');
};

const stripComments = (sql: string) => {
  const regExp = /(--[^\r\n]*)|(\/\*[\w\W]*?(?=\*\/)\*\/)/; // eslint-disable-line
  const comments = sql.match(new RegExp(regExp, 'gmi'));

  if (!comments?.length) {
    return sql;
  }

  return comments.reduce(
    (acc: string, comment: string) => acc.replace(comment, ''),
    sql,
  );
};

export const parseIdentifiersFromSQL = (sql: string): ParsedSQLEntity[] => {
  const objects: ParsedSQLEntity[] = [];
  const sanitizedSql = stripComments(sql);

  const regExp =
    /create\s*(?:|or\s*replace)\s*(?<type>view|table|function)\s*(?:\s*if*\s*not\s*exists\s*)?((?<schema>\"?\w+\"?)\.(?<nameWithSchema>\"?\w+\"?)|(?<name>\"?\w+\"?))\s*(?<partition>partition\s*of)?/gim; // eslint-disable-line

  Array.from(sanitizedSql.matchAll(regExp)).forEach((result) => {
    const { type, schema, name, nameWithSchema } = result.groups ?? {};

    if (type && (name || nameWithSchema)) {
      objects.push({
        type: type.toLowerCase(),
        schema: sanitizeValue(schema || 'public'),
        name: sanitizeValue(name || nameWithSchema),
      });
    }
  });

  return objects;
};
