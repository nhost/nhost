import CaretRight from '@/components/icons/CaretRight'
import Text from '@/components/ui/Text/Text'
import Link from 'next/link'
import React from 'react'

export function TopNavigation(props) {
  const category = props.category.split('-').join(' ')

  function uppercaseEdgeCases(subcategory) {
    switch (subcategory) {
      case 'sdk':
        return 'SDK'
      case 'cli':
        return 'CLI'
      default:
        return subcategory
    }
  }

  const subcategory = props.subcategory.split('-').join(' ')

  return (
    <div className="flex flex-row w-full">
      <Link href={`/${props.category}`} passHref>
        <Text
          variant="a"
          color="grey"
          className="self-center font-medium capitalize transition-colors duration-200 cursor-pointer hover:text-greyscaleDark"
          size="normal"
        >
          {category}
        </Text>
      </Link>
      <CaretRight className="self-center text-greyscaleGrey mx-1" />
      <Link href={`/${props.category}/${props.subcategory}`} passHref>
        <Text
          color="grey"
          className="self-center font-medium capitalize transition-colors duration-200 cursor-pointer hover:text-greyscaleDark"
          size="normal"
        >
          {uppercaseEdgeCases(subcategory)}
        </Text>
      </Link>
    </div>
  )
}
