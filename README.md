# Flyby

A lightweight library for mapping client-side interactions to server-side apis. The project was heavily influenced by angular's [ngResource](https://github.com/angular/angular.js/blob/master/src/ngResource/resource.js), and was originally built to bring the functionality out of the framework, allowing non-angular applications to use it's interface.

1. [usage](#usage)
2. [installing](#installing)
3. [building](#building)

<a name="usage"></a>
## Usage

The `Flyby` interface can be thought of as a factory - it builds an interface that expose [actions](#actions) which provide semantically intuitive communication between client side data and server side apis.

### Defining a resource

`Flyby(<url template>, <url mappings>, <custom actions>)`

param | type | details
----- | ----- | -----
url template | string | the string used by the resource factory to generate the final url based on data sent into the api call. parameters in the template are 
url mappings | object | in order for the factory to know how to...
custom actions | object | an object that defines custom actions following the `action` interface defined below.

<a name="url_mappings"></a>
**url mappings**

In order for the factory to know what information to use from the request data in the url template, definitions must provide an object to facilitate that operation. Each property of the object represents the *name of a parameter to be written into the url template*. For example, a resource defined with a url template of `/api/user/:id/:fn` would expect to see url mappings object with both an `id` and `fn` property. This could look like:

```
var User = Flyby("/api/user/:id/:fn", {
  id: "@id",
  fn: "@fn"
}, null);
```

If the parameter value is prefixed with `@` then the value for that parameter will be extracted from the corresponding property on the data object (provided when calling an action method). This means that executing the `get` method on the `User` resource defined above:

```
User.get({id: 1}, callback);
```

would create a `GET` request to: `/api/user/1`. Notice how the `fn` parameter was removed from the generated string, and the `id` parameter was replaced with the number `1`.

<a name="actions"></a>
### Actions & Default actions

Actions are the functions/methods included on the returned service created by the `Flyby` factory - e.g `create`, `update`, `destroy`, etc... Common API interactions are already covered by the `Flyby` factory out of the box. They are:

name | method | body | example
----- | ----- | ----- | ------
get | `GET` | no | `User.get({id: 1}, callback);`
update | `PATCH` | yes | `User.update({id: 1, name: "fred"}, callback);`
create | `POST` | yes | `User.create({name: "fred"}, callback);`
destroy | `DELETE` | yes | `User.destroy({id: 1}, callback);`

Each of these actions are objects based on this model:

<table>
  <thead>
    <tr>
      <th>name</th>
      <th>type</th>
      <th>default</th>
      <th>notes</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>`url`</td>
      <td>string</td>
      <td>the original url template</td>
      <td>If this property is left blank (or not a `string`) the action will "inherit" the url from the resource. See [customizing action urls](#customizing_action_urls).</td>
    </tr>
    <tr>
      <td>`method`</td>
      <td>string</td>
      <td>`GET`</td>
      <td>This is the http verb that the resource will use for the action's request.</td>
    </tr>
    <tr>
      <td>`has_body`</td>
      <td>boolean</td>
      <td>`false`</td>
      <td>Lets the factory know if it should use the data sent into it as query string information or request body data.</td>
    </tr>
    <tr>
      <td>`params`</td>
      <td>object</td>
      <td>none</td>
      <td>Allows the action to override the resource's default [url mappings](#url_mappings).</td>
    </tr>
    <tr>
      <td>`transform.response`</td>
      <td>`function`</td>
      <td>[default response transform](#transforms)</td>
      <td>This function gets called once the xhr has finished successfully, allowing users to manipulate their data before it is used by the callee.</td>
    </tr>
    <tr>
      <td>`transform.response`</td>
      <td>`function`</td>
      <td>[default response transform](#transforms)</td>
      <td>Allows users to override the function applied to the data before it is sent into the xhr.</td>
    </tr>
  </tbody>
</table>

<a name="callback"></a>
#### The callback

Unlike the [ngResource](https://github.com/angular/angular.js/blob/master/src/ngResource/resource.js) service, Flyby only uses "[error-first callbacks](http://thenodeway.io/posts/understanding-error-first-callbacks/)" to handle the asnychronous control-flow. This was done to avoid needing a [promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) shim/library - keeping the library smaller and free of third-party dependencies, *not because error-first callbacks are a better option than promises*. 

These error-first callback functions are used by the Flyby factory to communicate the [successfulness](#determining_success) of the action's operation. A typical usage might look something like this:

```
function callback(err, result, xhr) {
  if(err)
    return window.alert(xhr.status);

  // yay, we have a result
}

User.get({id: 1}, callback);
```

The function will be sent the following arguments:

argument index | notes
----- | ----
0 | An error object, if the status was [unsuccessful](#determining_success).
1 | The result of [transforming](#transforms) the response text
2 | The actual [XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) used by the action to send the http request.

<a name="transforms"></a>
#### Request & Response transforms

Though flyby does define default functions to handle massaging of data sent and received from the server, user's can override this behavior by providing a `transform` object with `response` and `request` functions.

**defaults**

transform | behavior
----- | -----
response | if the response headers contain `Content-Type: application/json`, this transform will try running `JSON.parse` on the text and returning the result.
request | if the request data is not a native `File`, `FormData`, or `Blob` data types, this transform will try running `JSON.stringify` on the data.


**example**

```javascript
define([
], function() {

  var User = Flyby("/api/users/:id", {id: "@id"}, {
    emote: {
      metod: "POST",
      has_body: true,
      transform: {
        request: function(data) {
          return {"emote": data};
        },
        response: function(response) {
          return JSON.parse(response).result;
        }
      }
    }
  });

  return User;

});
```

```javascript
require([
  "User"
], function(User) {

  /* if response succeeds (200 status code) and it responds with:
   *
   * {result: "freddy smiles."}
   *
   * this callback would log: "freddy smiles."
   */
  function finished(err, result) {
    console.log(result);
  }

  /* would send a POST request to /api/users
   * with the request body:
   *
   * {emote: "smile"}
   */
  User.emote("smile", finished); 

});
```
<a name="determining_success"></a>
#### How "successfulness" is determined

Flyby bases's an action's resulting successfulness on the [status code](http://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html) of the [XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) used during the call.

> Anything greater than 200 and less than 300

If the successfulness condition is satisfied, the first argument of the [callback](#callback) will be falsey.

<a name="customizing_action_urls"></a>
#### Customizing action urls

Sometimes it's helpful to define custom actions on a resource when the api supports "subresource" routes:

```
var User = Flyby("/api/users/:id", {id: "@id"}, {
  tracks: {
    method: "GET",
    url: "/api/users/:id/tracks"
  }
});
```

-----

### Complete example

Lets say we're using Flyby in a [requirejs](http://requirejs.org/) project that uses the [grunt requirejs optimizer task](https://github.com/gruntjs/grunt-contrib-requirejs) to compile the project.

*src/js/resources/user.coffee*
```coffeescript
define [
  "API_HOME"
  "Flyby"
], (API_HOME, Flyby) ->

  User = Flyby "#{API_HOME}/users/:id", null, null

```

*src/js/resources/user_account_mapping.coffee*
```coffeescript
define [
  "API_HOME"
  "Flyby"
], (API_HOME, Flyby) ->

  UserAccount = Flyby "#{API_HOME}/user_account/:id", null, null

```

*src/js/resources/account.coffee*
```coffeescript
define [
  "API_HOME"
  "Flyby"
], (API_HOME, Flyby) ->

  Account = Flyby "#{API_HOME}/accounts/:id", null, null

```

*src/js/managers/account.coffee*

```coffeescript
define [
  "resources/user"
  "resources/user_account_mapping"
  "resources/account"
], (User, UserAccountMapping, Account) ->

  class AccountManager
    
    constructor: (@user, @mappings=[], @accounts=[]) ->

    addBankAccount: (account_id, callback) ->
      mappings = @mappings
      created_mapping = null

      loadedAccount = (err, account) =>
        return callback err if err
        @accounts.push account
        callback false, created_mapping

      addedAccount = (err, new_mapping) ->
        return callback err if err
        mappings.push new_mapping
        created_mapping = new_mapping
        Account.get {id: account_id}, loadedAccount

      UserAccountMapping.create {
        user: @user.id
        account: account_id
      }, addedAccount
      

    updatePassword: (new_password, callback) ->
      finished = (err) =>
        callback err if err
        @emit "updated:password"
        callback false

      User.update {password: new_password, id: @user.id}, finished

```

---

## Installing

The compiled source for this library is published to a separate [respository](https://github.com/dadleyy/flyby-bower) during the build automation, and automatically published to [bower](http://bower.io/search/). This allows developers to install the compiled code through the bower cli and maintain it's version in their `bower.json`:

```
$ bower install flyby --save
```

This will download a copy of the compiled library and save it into the `bower_components` directory of your current project. From here, it is recommended that you use a tool like [grunt](http://gruntjs.com/) to [concatenate](https://github.com/gruntjs/grunt-contrib-concat) your vendor libraries together, including `flyby`. Using this approach will expose the `Flyby` api globally via the `window` object.

**requirejs**

The project is also compiled with a requirejs guard, making it an eligible requirejs module:

```
requirejs.config({
  paths: {
    "Flyby": "path/to/your/installation"
  }
});

require([
  "Flyby"
], function(Flyby) {

  return Flyby("/api/something/:id", {"id": "@id"}, {});

});
```

---

## Building

Flyby is built using [coffeescript](http://coffeescript.org/) and [grunt](http://gruntjs.com/).

```
$ git clone git@github.com:dadleyy/flyby.git
$ cd flyby
$ npm i
$ grunt
```

The `default` grunt task will clean, compile and run the tests for the code:

![image](https://cloud.githubusercontent.com/assets/1545348/11193391/771c3e32-8c74-11e5-9807-825acee8c421.png)

**release**

During release builds, `grunt release` can be executed to generate the minified code using [uglify](https://github.com/gruntjs/grunt-contrib-uglify).
