// # Module polygamous
//
// Clojure-style multi-methods for JavaScript.
//
//
// :licence: MIT
//   Copyright (c) 2013 Quildreen Motta
//
//   Permission is hereby granted, free of charge, to any person
//   obtaining a copy of this software and associated documentation files
//   (the "Software"), to deal in the Software without restriction,
//   including without limitation the rights to use, copy, modify, merge,
//   publish, distribute, sublicense, and/or sell copies of the Software,
//   and to permit persons to whom the Software is furnished to do so,
//   subject to the following conditions:
//
//   The above copyright notice and this permission notice shall be
//   included in all copies or substantial portions of the Software.
//
//   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
//   EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
//   MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
//   NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
//   LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
//   OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
//   WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// -- Dependencies -----------------------------------------------------
var equal           = require('deep-equal')
var clone           = Object.create
var internalClassOf = {}.toString

// -- Interfaces -------------------------------------------------------

// ### Type branch A
//
// Represents each computational branch in a multi-method.
//
// :: { condition: A, code: (B... -> C) }


// -- Error factories --------------------------------------------------

// ### Function noBranchFor
//
// Signaled when a dispatch value matches no branches.
//
// :: A -> error A
function noBranchFor(a) {
  var e = new Error('No branch responds to: ' + a)
  e.name = 'no-branch-error'
  return e
}

// ### Function ambiguousBranch
//
// Signaled when branches have equivalent evaluation conditions.
//
// :: A -> error A
function ambiguousBranch(a) {
  var e = new Error('Another branch is already responding to: ' + a)
  e.name = 'ambiguous-branch-error'
  return e
}


// -- Helpers ----------------------------------------------------------

// ### Function identity
//
// The identity function.
//
// :: A -> A
function identity(a) { return a }


// ### Function branchMatching
//
// Returns the branch matching a dispatch value.
//
// :: A, [branch A] -> maybe (branch A)
function branchMatching(value, branches) {
  var i = branches.length
  while (i--)
    if (equal(value, branches[i].condition))  return branches[i]

  return { condition: null, code: null }
}

function classOf(a) {
  return internalClassOf.call(a).slice(8, -1)
}

function isPrimitive(a) {
  return a != null
  &&     ['String', 'Boolean', 'Number'].indexOf(classOf(a)) != -1 }

function DispatchTable() {
  this.isValid       = false
  this.dispatchTable = {}
  this.currentType   = null
}

DispatchTable.prototype = {
  getBranch: function(key) {
    if (key == null || classOf(key) !== this.currentType)
      return { condition: null, code: null }

    return this.isValid?    this.dispatchTable[key]
    :      /* otherwise */  { condition: null, code: null }
  }

, invalidate: function() {
    this.isValid = false
    return this
  }

, add: function(k, f) {
    if (!isPrimitive(k))                  return this.invalidate()
    if (this.currentType === null)        this.currentType = classOf(k)
    if (this.currentType !== classOf(k))  return this.invalidate()

    this.dispatchTable[k] = f
    return this
  }
}


// -- Core implementation ----------------------------------------------

// ### Function method
//
// Constructs a multi-method.
//
// :: (A... -> B) -> method
function method(dispatch) {
  var branches      = []
  var baseline      = function(a){ throw noBranchFor(a) }
  var dispatchTable = new DispatchTable()

  dispatch = dispatch || identity

  return makeMethod(function() {
    var value  = dispatch.apply(null, arguments)
    var branch = dispatchTable.getBranch(value).code
              || branchMatching(value, branches).code
              || baseline

    return branch.apply(null, arguments)
  })


  // #### Function makeMethod
  //
  // Adds modification methods to a multi-method.
  //
  // :: method -> method
  function makeMethod(f) {
    f.when     = when
    f.fallback = fallback
    f.remove   = remove
    f.clone    = clone

    return f
  }

  // ### Function when
  //
  // Adds a branch to a multi-method.
  //
  // :: @method => A, (B... -> C) -> method
  function when(condition, f) {
    if (branchMatching(condition, branches).code)  throw ambiguousBranch(condition)

    branches.push({ condition: condition, code: f })
    dispatchTable.add(condition, f)
    return this
  }

  // ### Function fallback
  //
  // Adds a baseline branch, which is evaluated if no other branches
  // match a given dispatch value.
  //
  // :: @method => (A... -> B) -> method
  function fallback(f) {
    baseline = f
    return this
  }

  // ### Function remove
  //
  // Removes a branch from the multi-method.
  //
  // :: @method => A -> method
  function remove(condition) {
    branches = branches.filter(function(a) {
                                 return !equal(condition, a.condition)
                               })
    return this
  }

  // ### Function clone
  //
  // Creates a new multi-method that fallsback to this one.
  //
  // :: @method => Unit -> method
  function clone() {
    var instance = method(dispatch)
    instance.fallback(this)
    return instance
  }
}

// -- Exports ----------------------------------------------------------
module.exports = method