function getPostsData(posts: any[]) {
  return posts.map((post) => {
    return {
      params: {
        category: post.split('/')[0],
        subCategory: post.split('/')[1],
        post: post.split('/')[2].replace(/\.mdx$/, '')
      }
    }
  })
}

export default getPostsData
