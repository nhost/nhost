export interface ParsedSQLEntity {
  type: string;
  name: string;
  schema: string;
}

const createSQLRegex =
  /create\s*(?:|or\s*replace)\s*(?<type>view|table|function)\s*(?:\s*if*\s*not\s*exists\s*)?((?<schema>\"?\w+\"?)\.(?<nameWithSchema>\"?\w+\"?)|(?<name>\"?\w+\"?))\s*(?<partition>partition\s*of)?/gim; // eslint-disable-line

const getSQLValue = (value: string) => {
  const quotedStringRegex = /^".*"$/;

  let sqlValue = value;
  if (!quotedStringRegex.test(value)) {
    sqlValue = value?.toLowerCase() ?? '';
  }

  return sqlValue.replace(/['"]+/g, '');
};

const removeCommentsSQL = (sql: string) => {
  const commentsSQLRegex = /(--[^\r\n]*)|(\/\*[\w\W]*?(?=\*\/)\*\/)/; // eslint-disable-line
  const regExp = commentsSQLRegex;
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
  const sanitizedSql = removeCommentsSQL(sql);

  const regExp = createSQLRegex;

  Array.from(sanitizedSql.matchAll(regExp)).forEach((result) => {
    const { type, schema, name, nameWithSchema } = result.groups ?? {};

    if (type && (name || nameWithSchema)) {
      objects.push({
        type: type.toLowerCase(),
        schema: getSQLValue(schema || 'public'),
        name: getSQLValue(name || nameWithSchema),
      });
    }
  });

  return objects;
};
