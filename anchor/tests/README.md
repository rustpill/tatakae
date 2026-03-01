### Usage
Start from root
```bash
# 1st shell
$ cd anchor
$ solana-test-validator --reset --clone-upgradeable-program \
metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s --url mainnet-beta

# 2nd shell
$ cd anchor
$ anchor build
$ anchor deploy
$ ts-node tests/scripts/setup.ts
$ anchor test --skip-local-validator --skip-deploy
```