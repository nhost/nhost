import SchemaBuilder from '@pothos/core'
import { createYoga } from 'graphql-yoga'

class Human {
  public pets: Pet[] = []
  constructor(public phoneNumber: string, public firstName: string) {}
}

class Pet {
  name: string
  diet: Diet
  owner: Human
  constructor(name: string, diet: Diet, owner: Human) {
    this.name = name
    this.diet = diet
    this.owner = owner
  }
  // constructor(public name: string, public diet: Diet, public owner: Human) {}
}

enum Diet {
  HERBIVOROUS,
  CARNIVOROUS,
  OMNIVORIOUS
}

export class Dog extends Pet {
  constructor(name: string, owner: Human, public barks: boolean) {
    super(name, Diet.CARNIVOROUS, owner)
  }
}

export class Hamster extends Pet {
  constructor(name: string, owner: Human, public squeaks: boolean) {
    super(name, Diet.HERBIVOROUS, owner)
  }
}

const human1 = new Human('123-456-7890', 'John')
const dog1 = new Dog('Fido', human1, false)
const dog2 = new Dog('Rover', human1, true)
const hamster1 = new Hamster('Hammy', human1, true)
human1.pets = [dog1, dog2, hamster1]

const builder = new SchemaBuilder<{
  Objects: {
    Pet: Pet
    Human: Human
    Dog: Dog
  }
}>({})

const HumanObject = builder.objectType('Human', {
  fields: (t) => ({
    phoneNumber: t.exposeString('phoneNumber', {}),
    firstName: t.exposeString('firstName', {}),
    pets: t.field({
      type: [Pet],
      resolve: (h) => h.pets
    })
  })
})

const PetObject = builder.interfaceType(Pet, {
  name: 'Pet',
  fields: (t) => ({
    name: t.exposeString('name', {}),
    owner: t.field({ type: HumanObject, resolve: (p) => p.owner }),
    diet: t.expose('diet', {
      type: Diet
    })
  })
})

const DogObject = builder.objectType('Dog', {
  interfaces: [Pet],
  isTypeOf: (value) => value instanceof Dog,
  fields: (t) => ({
    barks: t.exposeBoolean('barks', {})
  })
})

const HamsterObject = builder.objectType(Hamster, {
  name: 'Hamster',
  interfaces: [Pet],
  isTypeOf: (value) => value instanceof Hamster,
  fields: (t) => ({
    squeaks: t.exposeBoolean('squeaks', {})
  })
})

builder.enumType(Diet, {
  name: 'Diet'
})

const Anyone = builder.unionType('Anyone', {
  types: [DogObject, HamsterObject, HumanObject],
  resolveType: (fact) => {
    if (fact instanceof Human) {
      return HumanObject
    }
    if (fact instanceof Dog) {
      return DogObject
    }
    if (fact instanceof Hamster) {
      return HamsterObject
    }
  }
})

builder.queryField('everyone', (t) =>
  t.field({
    type: [Anyone],
    resolve: () => {
      return [human1, dog1, dog2, hamster1]
    }
  })
)

builder.queryField('pets', (t) =>
  t.field({ type: [PetObject], resolve: () => [dog1, dog2, hamster1] })
)
builder.queryField('dogs', (t) => t.field({ type: [DogObject], resolve: () => [dog1, dog2] }))
builder.queryField('hamsters', (t) => t.field({ type: [HamsterObject], resolve: () => [hamster1] }))

builder.queryType({})

export default createYoga({
  schema: builder.toSchema(),
  graphqlEndpoint: '/'
})
