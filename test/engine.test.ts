// Run with: node src/game/engine.test.ts
import assert from 'node:assert/strict'
import { Game, TRUTH_POINTS, FOOL_POINTS } from '../src/game/engine.ts'

const g = new Game('ABCD', 'a')
assert.equal(g.join('a', 'Ann'), null)
assert.equal(g.join('b', 'Ben'), null)
assert.match(g.join('c', 'ann') ?? '', /name/)
assert.match(g.start() ?? '', /at least 3/)
assert.equal(g.join('c', 'Cat'), null)
assert.equal(g.start(), null)
assert.equal(g.phase, 'answering')

const truth = (() => {
  // peek truth through reveal later; here just get prompt
  return g.view('a').prompt
})()
assert.ok(truth)

assert.match(g.submitAnswer('a', '   ') ?? '', /Write/)
assert.equal(g.submitAnswer('a', 'Fake one'), null)
assert.equal(g.submitAnswer('b', 'fake ONE!'), null) // dup of a's -> merged
assert.equal(g.phase, 'answering')
assert.equal(g.submitAnswer('c', 'Something else'), null)
assert.equal(g.phase, 'voting')

const v = g.view('a')
assert.equal(v.options!.length, 3) // merged fake + other fake + truth
assert.equal(v.myOptions!.length, 1)
assert.equal(v.reveal, undefined)
assert.match(g.vote('a', v.myOptions![0]) ?? '', /own/)

// find option ids via a full reveal later; first discover truth by voting all
const opts = v.options!
const optC = g.view('c').myOptions![0]
const optAB = v.myOptions![0]
const truthOpt = opts.find((o) => o.id !== optC && o.id !== optAB)!.id
assert.equal(g.vote('a', optC), null)
assert.equal(g.vote('b', truthOpt), null)
assert.equal(g.phase, 'voting')
assert.equal(g.vote('c', optAB), null)
assert.equal(g.phase, 'reveal')

const rv = g.view('a').reveal!
const score = (n: string) => g.view('a').players.find((p) => p.name === n)!.score
assert.equal(score('Ben'), TRUTH_POINTS + FOOL_POINTS) // found truth + shared fake fooled Cat
assert.equal(score('Cat'), FOOL_POINTS) // fooled Ann
assert.equal(score('Ann'), FOOL_POINTS) // shared fake fooled Cat
assert.equal(rv.rows.find((r) => r.isTruth)!.voters.join(), 'Ben')

// continue through all rounds with disconnect handling
g.setRounds(5) // ignored outside lobby
assert.equal(g.totalRounds, 8)
for (let i = 1; i < 8; i++) {
  assert.equal(g.advance(), null)
  assert.equal(g.phase, 'answering')
  g.setConnected('c', false) // Cat drops; others finish without her
  g.submitAnswer('a', 'x' + i)
  g.submitAnswer('b', 'y' + i)
  assert.equal(g.phase, 'voting')
  const vv = g.view('a')
  const other = vv.options!.find((o) => !vv.myOptions!.includes(o.id))!.id
  g.vote('a', other)
  g.vote('b', g.view('b').options!.find((o) => !g.view('b').myOptions!.includes(o.id))!.id)
  assert.equal(g.phase, 'reveal')
  g.join('c', '') // reconnect
}
assert.equal(g.advance(), null)
assert.equal(g.phase, 'final')
assert.match(g.join('z', 'Zed') ?? '', /started/)
g.backToLobby()
assert.equal(g.phase, 'lobby')
assert.equal(g.start(), null)
console.log('engine ok')
