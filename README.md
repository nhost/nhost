![Nhost](https://i.imgur.com/ZenoUlM.png)

<div align="center">

# Nhost

<a href="https://docs.nhost.io/#quickstart">Quickstart</a>
<span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
<a href="http://nhost.io/">Website</a>
<span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
<a href="https://docs.nhost.io">Docs</a>
<span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
<a href="https://nhost.io/blog">Blog</a>
<span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
<a href="https://twitter.com/nhost">Twitter</a>
<span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
<a href="https://nhost.io/discord">Discord</a>
<br />

  <hr />
</div>

**Nhost is an open source Firebase alternative with GraphQL,** built with the following things in mind:

- Open Source
- GraphQL
- SQL
- Great Developer Experience

Nhost consists of open source software:

- Database: [PostgreSQL](https://www.postgresql.org/)
- Instant GraphQL API: [Hasura](https://hasura.io/)
- Authentication: [Hasura Auth](https://github.com/nhost/hasura-auth/)
- Storage: [Hasura Storage](https://github.com/nhost/hasura-storage)
- Serverless Functions: Node.js (JavaScript and TypeScript)
- [Nhost CLI](https://docs.nhost.io/reference/cli) for local development

## Architecture of Nhost

<div align="center">
  <br />
  <img src="assets/nhost-diagram.png"/>
  <br />
  <br />
</div>

Visit [https://docs.nhost.io](http://docs.nhost.io) for the complete documentation.

# Get Started

## Option 1: Nhost Hosted Platform

1. Sign in to [Nhost](https://app.nhost.io).
2. Create Nhost app.
3. Done.

## Option 2: Self-hosting

Since Nhost is 100% open source, you can self-host the whole Nhost stack. Check out the example [docker-compose file](https://github.com/nhost/nhost/tree/main/examples/docker-compose) to self-host Nhost.

## Sign In and Make a Graphql Request

Install the `@nhost/nhost-js` package and start build your app:

```jsx
import { NhostClient } from '@nhost/nhost-js'

const nhost = new NhostClient({
  subdomain: '<your-subdomain>',
  region: '<your-region>'
})

await nhost.auth.signIn({ email: 'elon@musk.com', password: 'spaceX' })

await nhost.graphql.request(`{
  users {
    id
    displayName
    email
  }
}`)
```

## Frontend Agnostic

Nhost is frontend agnostic, which means Nhost works with all frontend frameworks.

<div align="center">
  <a href="https://github.com/nhost/nhost/tree/main/templates/web/nextjs-apollo"><img src="assets/nextjs.svg"/></a>
  <a href="https://github.com/nhost/nhost/tree/main/examples/nuxt-apollo"><img src="assets/nuxtjs.svg"/></a>
  <a href="https://github.com/nhost/nhost/tree/main/templates/web/react-apollo"><img src="assets/react.svg"/></a>
  <img src="assets/react-native.svg"/>
  <a href="https://github.com/nhost/nhost/tree/main/packages/nhost-js"><img src="assets/svelte.svg"/></a>
  <a href="https://github.com/nhost/nhost/tree/main/packages/nhost-js"><img src="assets/vuejs.svg"/></a>
</div>

# Resources

Nhost libraries and tools

- [JavaScript/TypeScript SDK](https://docs.nhost.io/reference/javascript)
- [Dart and Flutter SDK](https://github.com/nhost/nhost-dart)
- [Nhost CLI](https://docs.nhost.io/reference/cli)
- [Nhost React](https://docs.nhost.io/reference/react)
- [Nhost Next.js](https://docs.nhost.io/reference/nextjs)
- [Nhost Vue](https://docs.nhost.io/reference/vue)

## Community ❤️

First and foremost: **Star and watch this repository** to stay up-to-date.

Also, follow Nhost on [GitHub Discussions](https://github.com/nhost/nhost/discussions), our [Blog](https://nhost.io/blog), and on [Twitter](https://twitter.com/nhostio). You can chat with the team and other members on [Discord](https://discord.com/invite/9V7Qb2U) and follow our tutorials and other video material at [YouTube](https://www.youtube.com/channel/UCJ7irtvV9Y0EQMxpabb6ntg?view_as=subscriber).

### Nhost is Open Source

This repository, and most of our other open source projects, are licensed under the MIT license.

<a href="https://runacap.com/ross-index/q1-2022/" target="_blank" rel="noopener">
    <img style="width: 260px; height: 56px" src="https://runacap.com/wp-content/uploads/2022/06/ROSS_badge_black_Q1_2022.svg" alt="ROSS Index - Fastest Growing Open-Source Startups in Q1 2022 | Runa Capital" width="260" height="56" />
</a>

### How to contribute

Here are some ways of contributing to making Nhost better:

- **[Try out Nhost](https://docs.nhost.io/get-started/quick-start)**, and think of ways to make the service better. Let us know here on GitHub.
- Join our [Discord](https://discord.com/invite/9V7Qb2U) and connect with other members to share and learn from.
- Send a pull request to any of our [open source repositories](https://github.com/nhost) on Github. Check our [contribution guide](https://github.com/nhost/nhost/blob/main/CONTRIBUTING.md) and our [developers guide](https://github.com/nhost/nhost/blob/main/DEVELOPERS.md) for more details about how to contribute. We're looking forward to your contribution!

### Contributors

<!-- readme: contributors -start -->
<table>
<tr>
    <td align="center">
        <a href="https://github.com/plmercereau">
            <img src="https://avatars.githubusercontent.com/u/24897252?v=4" width="100;" alt="plmercereau"/>
            <br />
            <sub><b>Pilou</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/elitan">
            <img src="https://avatars.githubusercontent.com/u/331818?v=4" width="100;" alt="elitan"/>
            <br />
            <sub><b>Johan Eliasson</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/nunopato">
            <img src="https://avatars.githubusercontent.com/u/1523504?v=4" width="100;" alt="nunopato"/>
            <br />
            <sub><b>Nuno Pato</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/gdangelo">
            <img src="https://avatars.githubusercontent.com/u/4352286?v=4" width="100;" alt="gdangelo"/>
            <br />
            <sub><b>Grégory D'Angelo</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/szilarddoro">
            <img src="https://avatars.githubusercontent.com/u/310881?v=4" width="100;" alt="szilarddoro"/>
            <br />
            <sub><b>Szilárd Dóró</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/guicurcio">
            <img src="https://avatars.githubusercontent.com/u/20285232?v=4" width="100;" alt="guicurcio"/>
            <br />
            <sub><b>Guido Curcio</b></sub>
        </a>
    </td></tr>
<tr>
    <td align="center">
        <a href="https://github.com/subatuba21">
            <img src="https://avatars.githubusercontent.com/u/34824571?v=4" width="100;" alt="subatuba21"/>
            <br />
            <sub><b>Subha Das</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/sebagudelo">
            <img src="https://avatars.githubusercontent.com/u/43288271?v=4" width="100;" alt="sebagudelo"/>
            <br />
            <sub><b>Sebagudelo</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/mrinalwahal">
            <img src="https://avatars.githubusercontent.com/u/9859731?v=4" width="100;" alt="mrinalwahal"/>
            <br />
            <sub><b>Mrinal Wahal</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/timpratim">
            <img src="https://avatars.githubusercontent.com/u/32492961?v=4" width="100;" alt="timpratim"/>
            <br />
            <sub><b>Pratim</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/GavanWilhite">
            <img src="https://avatars.githubusercontent.com/u/2085119?v=4" width="100;" alt="GavanWilhite"/>
            <br />
            <sub><b>Gavan Wilhite</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/FuzzyReason">
            <img src="https://avatars.githubusercontent.com/u/62517920?v=4" width="100;" alt="FuzzyReason"/>
            <br />
            <sub><b>Vadim Smirnov</b></sub>
        </a>
    </td></tr>
<tr>
    <td align="center">
        <a href="https://github.com/macmac49">
            <img src="https://avatars.githubusercontent.com/u/831190?v=4" width="100;" alt="macmac49"/>
            <br />
            <sub><b>Macmac49</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/subhendukundu">
            <img src="https://avatars.githubusercontent.com/u/20059141?v=4" width="100;" alt="subhendukundu"/>
            <br />
            <sub><b>Subhendu Kundu</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/heygambo">
            <img src="https://avatars.githubusercontent.com/u/449438?v=4" width="100;" alt="heygambo"/>
            <br />
            <sub><b>Christian Gambardella</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/chrtze">
            <img src="https://avatars.githubusercontent.com/u/3797215?v=4" width="100;" alt="chrtze"/>
            <br />
            <sub><b>Christopher Möller</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/dbarrosop">
            <img src="https://avatars.githubusercontent.com/u/6246622?v=4" width="100;" alt="dbarrosop"/>
            <br />
            <sub><b>David Barroso</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/hajek-raven">
            <img src="https://avatars.githubusercontent.com/u/7288737?v=4" width="100;" alt="hajek-raven"/>
            <br />
            <sub><b>Filip Hájek</b></sub>
        </a>
    </td></tr>
<tr>
    <td align="center">
        <a href="https://github.com/MelodicCrypter">
            <img src="https://avatars.githubusercontent.com/u/18341500?v=4" width="100;" alt="MelodicCrypter"/>
            <br />
            <sub><b>Hugh Caluscusin</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/jerryjappinen">
            <img src="https://avatars.githubusercontent.com/u/1101002?v=4" width="100;" alt="jerryjappinen"/>
            <br />
            <sub><b>Jerry Jäppinen</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/mdp18">
            <img src="https://avatars.githubusercontent.com/u/11698527?v=4" width="100;" alt="mdp18"/>
            <br />
            <sub><b>Max</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/mustafa-hanif">
            <img src="https://avatars.githubusercontent.com/u/30019262?v=4" width="100;" alt="mustafa-hanif"/>
            <br />
            <sub><b>Mustafa Hanif</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/nbourdin">
            <img src="https://avatars.githubusercontent.com/u/5602476?v=4" width="100;" alt="nbourdin"/>
            <br />
            <sub><b>Nicolas Bourdin</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/Savinvadim1312">
            <img src="https://avatars.githubusercontent.com/u/16936043?v=4" width="100;" alt="Savinvadim1312"/>
            <br />
            <sub><b>Savin Vadim</b></sub>
        </a>
    </td></tr>
<tr>
    <td align="center">
        <a href="https://github.com/Svarto">
            <img src="https://avatars.githubusercontent.com/u/24279217?v=4" width="100;" alt="Svarto"/>
            <br />
            <sub><b>Svarto</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/muttenzer">
            <img src="https://avatars.githubusercontent.com/u/49474412?v=4" width="100;" alt="muttenzer"/>
            <br />
            <sub><b>Muttenzer</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/ahmic">
            <img src="https://avatars.githubusercontent.com/u/13452362?v=4" width="100;" alt="ahmic"/>
            <br />
            <sub><b>Amir Ahmic</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/akd-io">
            <img src="https://avatars.githubusercontent.com/u/30059155?v=4" width="100;" alt="akd-io"/>
            <br />
            <sub><b>Anders Kjær Damgaard</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/Sonichigo">
            <img src="https://avatars.githubusercontent.com/u/53110238?v=4" width="100;" alt="Sonichigo"/>
            <br />
            <sub><b>Animesh Pathak</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/rustyb">
            <img src="https://avatars.githubusercontent.com/u/53086?v=4" width="100;" alt="rustyb"/>
            <br />
            <sub><b>Colin Broderick</b></sub>
        </a>
    </td></tr>
<tr>
    <td align="center">
        <a href="https://github.com/dminkovsky">
            <img src="https://avatars.githubusercontent.com/u/218725?v=4" width="100;" alt="dminkovsky"/>
            <br />
            <sub><b>Dmitry Minkovsky</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/dohomi">
            <img src="https://avatars.githubusercontent.com/u/489221?v=4" width="100;" alt="dohomi"/>
            <br />
            <sub><b>Dominic Garms</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/gaurav1999">
            <img src="https://avatars.githubusercontent.com/u/20752142?v=4" width="100;" alt="gaurav1999"/>
            <br />
            <sub><b>Gaurav Agrawal</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/alveshelio">
            <img src="https://avatars.githubusercontent.com/u/8176422?v=4" width="100;" alt="alveshelio"/>
            <br />
            <sub><b>Helio Alves</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/nkhdo">
            <img src="https://avatars.githubusercontent.com/u/26102306?v=4" width="100;" alt="nkhdo"/>
            <br />
            <sub><b>Hoang Do</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/jladuval">
            <img src="https://avatars.githubusercontent.com/u/1935359?v=4" width="100;" alt="jladuval"/>
            <br />
            <sub><b>Jacob Duval</b></sub>
        </a>
    </td></tr>
<tr>
    <td align="center">
        <a href="https://github.com/kylehayes">
            <img src="https://avatars.githubusercontent.com/u/509932?v=4" width="100;" alt="kylehayes"/>
            <br />
            <sub><b>Kyle Hayes</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/leothorp">
            <img src="https://avatars.githubusercontent.com/u/12928449?v=4" width="100;" alt="leothorp"/>
            <br />
            <sub><b>Leo Thorp</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/LucasBois1">
            <img src="https://avatars.githubusercontent.com/u/44686060?v=4" width="100;" alt="LucasBois1"/>
            <br />
            <sub><b>Lucas Bois</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/MarcelloTheArcane">
            <img src="https://avatars.githubusercontent.com/u/21159570?v=4" width="100;" alt="MarcelloTheArcane"/>
            <br />
            <sub><b>Max Reynolds</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/nachoaldamav">
            <img src="https://avatars.githubusercontent.com/u/22749943?v=4" width="100;" alt="nachoaldamav"/>
            <br />
            <sub><b>Nacho Aldama</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/ghoshnirmalya">
            <img src="https://avatars.githubusercontent.com/u/6391763?v=4" width="100;" alt="ghoshnirmalya"/>
            <br />
            <sub><b>Nirmalya Ghosh</b></sub>
        </a>
    </td></tr>
<tr>
    <td align="center">
        <a href="https://github.com/quentin-decre">
            <img src="https://avatars.githubusercontent.com/u/1137511?v=4" width="100;" alt="quentin-decre"/>
            <br />
            <sub><b>Quentin Decré</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/atapas">
            <img src="https://avatars.githubusercontent.com/u/3633137?v=4" width="100;" alt="atapas"/>
            <br />
            <sub><b>Tapas Adhikary</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/uulwake">
            <img src="https://avatars.githubusercontent.com/u/22399181?v=4" width="100;" alt="uulwake"/>
            <br />
            <sub><b>Ulrich Wake</b></sub>
        </a>
    </td>
    <td align="center">
        <a href="https://github.com/komninoschat">
            <img src="https://avatars.githubusercontent.com/u/29049104?v=4" width="100;" alt="komninoschat"/>
            <br />
            <sub><b>Komninos</b></sub>
        </a>
    </td></tr>
</table>
<!-- readme: contributors -end -->
