.PHONY: install start demo build lint format format-check rollup typecheck test test-watch test-coverage

install:
	corepack yarn install

start:
	corepack yarn start

demo:
	corepack yarn demo

build:
	corepack yarn build

lint:
	corepack yarn lint

format:
	corepack yarn format

format-check:
	corepack yarn format:check

rollup:
	corepack yarn rollup

typecheck:
	corepack yarn typecheck

test:
	corepack yarn test

test-watch:
	corepack yarn test:watch

test-coverage:
	corepack yarn test:coverage
