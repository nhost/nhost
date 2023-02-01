import glob from "fast-glob";
import Link from "next/link";
import * as path from "path";

export default function ArticlesIndex({ articles }: { articles: any }) {
  return (
    <div>
      {articles.map((article: any) => {
        return (
          <div key={article.slug}>
            <h2>{article.title}</h2>
            <div>{article.date}</div>
            <div>
              <Link href={`/blog/${article.slug}`}>Read more</Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

async function importArticle(articleFilename: any) {
  // if we change the location of this folder, make sure the path is correct!
  let { meta, default: component } = await import(`./${articleFilename}`);
  return {
    slug: articleFilename.replace(/(\/index)?\.mdx$/, ""),
    ...meta,
    component,
  };
}

export async function getStaticProps() {
  // TODO: move this function to a separate file
  const getAllArticles = async () => {
    let articleFilenames = await glob(["*.mdx", "*/index.mdx"], {
      cwd: path.join(process.cwd(), "src/pages/blog"),
    });

    let articles = await Promise.all(articleFilenames.map(importArticle));

    console.log(articles);

    return articles;

    // TODO: fix this sort
    // return articles.sort((a: any, z: any) => {
    //   return !!(new Date(z.date) > new Date(a.date));
    // }
  };

  return {
    props: {
      articles: (await getAllArticles()).map(({ component, ...meta }) => meta),
    },
  };
}
