import fs from 'fs'
import matter from 'gray-matter'
import { join } from 'path'

import { orderTwo } from './order'

const { execSync } = require('child_process')
const postsDirectory = join(process.cwd(), 'content', 'docs')

export function createConvolutedNav(category) {
  const { allPosts, postsCategoryDirectory } = getAllPostsByCategory(category)
  let allPostUnder = []
  // categoryTitle: {
  //       ...matter(
  //         fs.readFileSync(
  //           join(postsDirectory, `${category}/${subCategory}/index.mdx`)
  //         )
  //       ),
  //     }.data.title,

  removeIndexFile(allPosts).forEach((subCategory) => {
    allPostUnder.push({
      category: subCategory,

      posts: getAllPostsBySubCategory(postsCategoryDirectory, subCategory)
        .map((post) => {
          return {
            fileName: post.replace('.mdx', ''),
            ...matter(fs.readFileSync(join(postsDirectory, `${category}/${subCategory}/${post}`)))
              .data,
            order: orderTwo[category][subCategory]
          }
        })
        .sort((a, b) => {
          return (
            orderTwo[category][subCategory].indexOf(a.fileName) -
            orderTwo[category][subCategory].indexOf(b.fileName)
          )
        })
    })
  })

  return allPostUnder.sort(
    (a, b) =>
      Object.keys(orderTwo[category]).indexOf(a.category) -
      Object.keys(orderTwo[category]).indexOf(b.category)
  )
}

// function getAllHeadings() {
//   const posts = getAllPosts()
//   const sepa = posts.map((post) => {
//     return {
//       category: post.split("/")[0],
//       post: post.split("/")[1].replace(/\.mdx$/, ""),
//     };
//   })
//   const contents = sepa.map((post) => {
//     return {
//       category: post.category, post: post.post, content: getHeadingsByPost(matter(fs.readFileSync(join(postsDirectory, `${post.category}/${post.post}.mdx`))).content)
//     }
//   })
//   return contents
// }

export function getHeadingsByPost(content: string) {
  let headings: { depth: number; name: string }[] = []
  content.split('\n').forEach((str: string) => {
    if (str.startsWith('# ')) {
      headings.push({ depth: 1, name: str.split('# ')[1] })
    } else if (str.startsWith('## ')) {
      headings.push({ depth: 2, name: str.split('## ')[1] })
    } else if (str.startsWith('### ')) {
      headings.push({ depth: 3, name: str.split('### ')[1] })
    }
  })
  return headings
}

export function getAllPostsByCategory(category: string) {
  // Check that the category passed in is actually an existent category.
  const postsCategoryDirectory = join(process.cwd(), 'content', 'docs', category)
  let allPosts = []
  fs.readdirSync(postsCategoryDirectory).forEach((file) => {
    allPosts.push(file)
  })
  return { allPosts, postsCategoryDirectory }
}

export function getAllPostsBySubCategory(path, subcategory: string) {
  // Check that the category passed in is actually an existent category.
  const postsCategoryDirectory = join(path, subcategory)
  let postsBySubcategory = []
  fs.readdirSync(postsCategoryDirectory).forEach((file) => {
    postsBySubcategory.push(file)
  })
  return postsBySubcategory
}

export function removeIndexFile(posts) {
  return posts.filter((post) => !post.includes('index.mdx'))
}

export function getAllPosts() {
  const postsDirectory = join(process.cwd(), 'content', 'docs')
  let categories = []
  let subcategories = []
  let categoriesAndSubcategories = []
  let posts = []

  let vari
  fs.readdirSync(postsDirectory).forEach((file) => {
    let absolute = join(postsDirectory, file)

    if (fs.statSync(absolute).isDirectory()) {
      categories.push(file)
      fs.readdirSync(absolute).forEach((subFile) => {
        vari = join(absolute, subFile)
        if (fs.statSync(vari).isDirectory()) {
          subcategories.push(subFile)
          categoriesAndSubcategories.push(`${file}/${subFile}`)
          // If it's a directory, we can scan its files which are posts;
          fs.readdirSync(vari).forEach((post) => {
            posts.push(file.concat('/' + subFile + '/' + post))
          })
        }
      })
    }
  })
  return { categories, subcategories, posts, categoriesAndSubcategories }
}
