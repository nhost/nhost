<script>
  import { restore, mutate } from 'svelte-apollo';
  import { client } from './apollo';
  import gql from 'graphql-tag';

  const ARTICLE_LIST = gql`
    query {
      article(order_by: [{title: asc}]) {
        title
      }
    }
  `;
  const ADD_ARTICLE = gql`
    mutation ($title: String!,$content: String!,$author_id: Int!) {
      insert_article(objects: [{title: $title, content: $content, author_id: $author_id}]) {
        affected_rows
      }
    }
  `;
  let title = '';
  let content = '';
  let author_id = '';
  export let articleCache;
  
  async function addArticles(e) {
    e.preventDefault();
    try {
      await mutate(client, {
        mutation: ADD_ARTICLE,
        variables: { title,content,author_id }
      });
      alert("Added successfully");
      const finalData = articleCache.data.article;
      finalData.push({title,content,author_id, '__typename': 'article'});
      restore(client, ARTICLE_LIST, {article: finalData});
      // clear input
      title = '';
      content = '';
      author_id = '';
    } catch(error) {
      console.error(error);
    }
  }
</script>

<form on:submit={addArticles}>
  <label for="article">Article</label>
  <input type="text" id="article-title" bind:value={title} />
  <input type="text" id="article-content" bind:value={content} />
  <input type="text" id="article-author_id" bind:value={author_id} />
  <button type="submit">Add Article</button>
</form>