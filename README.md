
## Getting Started

First, install all dependencies with:

```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

Then start the development server with:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Development of Smart Contracts

Create a new contract under `contracts`. It must be of type `Contract` be exported as default. Use the other contracts as inspiration.

Afterwards, add the contract to the `persistenceStorage.ts` file, to make it available to the dev-kit.

At this point you are able to write your own inscriptions in the format of Lambda to have them update the storage and transaction log.


## Missing from the Dev-Kit

- [ ] Multi Inscription Support
- [ ] Deployment of contracts dynamically
