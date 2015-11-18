(function() {
  var CHAR_ENCODINGS, DEFAULT_ACTIONS, DEFAULT_HEADERS, Flyby, MEMBER_NAME_REGEX, defaultRequestTransform, defaultResponseTransform, fn, headerGetterFactory, isBlob, isFile, isFormData, isFunction, isObject, isSuccess, replacementFactory, toJson, toString, typeCheck, validDottedPath,
    slice = [].slice;

  DEFAULT_ACTIONS = {
    get: {
      method: "GET"
    },
    create: {
      method: "POST",
      has_body: true
    },
    update: {
      method: "PATCH",
      has_body: true
    },
    destroy: {
      method: "DESTROY",
      has_body: true
    }
  };

  MEMBER_NAME_REGEX = /^(\.[a-zA-Z_$][0-9a-zA-Z_$]*)+$/;

  DEFAULT_HEADERS = {
    "Content-Type": "application/json; charset=utf-8",
    "Accept": "application/json, text/plain, */*"
  };

  CHAR_ENCODINGS = {
    "%40": "@",
    "%3A": ":",
    "%24": "$",
    "%2C": ",",
    "%3B": ";"
  };

  toString = Object.prototype.toString;

  isSuccess = function(code) {
    return code >= 200 && code < 300;
  };

  isObject = function(x) {
    return /object/i.test(typeof x);
  };

  typeCheck = function(tester) {
    return function(x) {
      return ((toString.call(x)).match(tester)) !== null;
    };
  };

  isFile = typeCheck(/\[object\sfile\]/i);

  isBlob = typeCheck(/\[object\sblob\]/i);

  isFormData = typeCheck(/\[object\sformdata\]/i);

  toJson = function(x) {
    return JSON.stringify(x);
  };

  isFunction = function(x) {
    return /function/i.test(typeof x);
  };

  validDottedPath = function(path) {
    var dot_path, is_member, not_prop;
    not_prop = path !== "hasOwnProperty";
    dot_path = ['.', path].join("");
    is_member = MEMBER_NAME_REGEX.test(dot_path);
    return path && not_prop && is_member;
  };

  replacementFactory = function(value) {
    return function(match, p1) {
      return ("" + value) + p1;
    };
  };

  headerGetterFactory = function(str) {
    var lines, lookup, matches;
    lines = (str || "").split("\n");
    matches = function(line, key) {
      var rgx;
      rgx = new RegExp(key, "gi");
      return rgx.test(line);
    };
    lookup = function(key) {
      var l, parts, result;
      if (!(typeof key).match(/string/i)) {
        return void 0;
      }
      result = ((function() {
        var i, len, results;
        results = [];
        for (i = 0, len = lines.length; i < len; i++) {
          l = lines[i];
          if (matches(l, key)) {
            results.push(l);
          }
        }
        return results;
      })())[0];
      if (!result || (result.split(":")).length !== 2) {
        return void 0;
      }
      parts = result.split(":");
      return parts[1].replace(/\s|\n|\r\n/g, "");
    };
    return lookup;
  };

  defaultRequestTransform = function(data) {
    var can_stringify;
    can_stringify = (isObject(data)) && !(isFile(data)) && !(isFormData(data));
    if (can_stringify) {
      return toJson(data);
    } else {
      return data;
    }
  };

  defaultResponseTransform = function(data, header_string) {
    var content_type, header, result;
    result = data;
    if (!(typeof data).match(/string/i)) {
      return result;
    }
    header = headerGetterFactory(header_string);
    content_type = header("content-type");
    if (!content_type || !(content_type.match(/^application\/json$/i))) {
      return result;
    }
    try {
      result = JSON.parse(data);
    } catch (_error) {
      result = data;
    }
    return result;
  };

  fn = {
    xhr: function() {
      return new window.XMLHttpRequest();
    },
    extend: function() {
      var a, next, o, sources, target;
      target = arguments[0], sources = 2 <= arguments.length ? slice.call(arguments, 1) : [];
      if (sources.length < 1 || !(/object/i.test(typeof target))) {
        return target;
      }
      next = sources.shift();
      for (o in next) {
        a = next[o];
        target[o] = a;
      }
      if (sources.length > 0) {
        return fn.extend.apply(target, [target].concat(sources));
      }
      return target;
    },
    paramRgx: function(part) {
      return new RegExp("(^|[^\\\\]):" + part + "(\\W|$)");
    },
    lookupDotted: function(data, path) {
      var k, keys;
      if (!validDottedPath(path)) {
        return false;
      }
      keys = path.split(".");
      while (keys.length && data !== void 0) {
        k = keys.shift();
        data = data[k] ? data[k] : void 0;
      }
      return data;
    },
    extractObjectMappings: function(data, mappings) {
      var data_val, m, result, v;
      if (data == null) {
        data = {};
      }
      if (mappings == null) {
        mappings = {};
      }
      result = {};
      for (m in mappings) {
        v = mappings[m];
        if ((typeof v === "string") && (v.charAt(0)) === "@") {
          data_val = fn.lookupDotted(data, v.slice(1));
          if (data_val) {
            result[m] = data_val;
          }
        }
        if (typeof v === "function") {
          result[m] = v(data);
        }
      }
      return result;
    },
    omit: function(obj, keys) {
      var k, result, v;
      if (keys == null) {
        keys = [];
      }
      if (!(/object/i.test(typeof obj))) {
        return obj;
      }
      result = {};
      for (k in obj) {
        v = obj[k];
        if ((keys.indexOf(k)) >= 0) {
          continue;
        }
        result[k] = v;
      }
      return result;
    },
    encodeUriQuery: function(str) {
      var replace, replace_rgx, rgx_str;
      rgx_str = (Object.keys(CHAR_ENCODINGS)).join("|");
      replace_rgx = new RegExp(rgx_str, "g");
      replace = function(match) {
        return CHAR_ENCODINGS[match];
      };
      return (encodeURIComponent(str)).replace(replace_rgx, replace);
    },
    queryString: function(data) {
      var k, parts, serialize, value;
      if (!/object/i.test(data)) {
        return false;
      }
      parts = [];
      serialize = function(v) {
        return v;
      };
      for (k in data) {
        value = data[k];
        parts.push((fn.encodeUriQuery(k)) + "=" + (fn.encodeUriQuery(serialize(value))));
      }
      if (parts.length > 0) {
        return parts.join("&");
      } else {
        return null;
      }
    },
    transformUrl: function(url_template, data) {
      var clearFn, empty_rgx, i, known_params, len, p, param_value, parts, pp, replacement_fn, replacement_rgx;
      if (url_template == null) {
        url_template = "";
      }
      if (data == null) {
        data = {};
      }
      parts = url_template.split(/\W/);
      known_params = {};
      for (i = 0, len = parts.length; i < len; i++) {
        p = parts[i];
        if (p && (fn.paramRgx(p)).test(url_template)) {
          known_params[p] = true;
        }
      }
      clearFn = function(match, leading_slashes, tailing) {
        var has_lead;
        has_lead = tailing.charAt(0) === '/';
        if (has_lead) {
          return tailing;
        }
        return leading_slashes + tailing;
      };
      for (pp in known_params) {
        param_value = data.hasOwnProperty(pp) ? data[pp] : null;
        empty_rgx = new RegExp("(\/?):" + pp + "(\\W|$)", "g");
        replacement_fn = clearFn;
        replacement_rgx = empty_rgx;
        if (param_value !== null && param_value !== void 0) {
          replacement_fn = replacementFactory(param_value);
          replacement_rgx = new RegExp(":" + pp + "(\\W|$)", "g");
        }
        url_template = url_template.replace(replacement_rgx, replacement_fn);
        url_template = url_template.replace(/\/\.(?=\w+($|\?))/, '.');
      }
      return url_template.replace(/\/$/, '');
    }
  };

  Flyby = function(resource_url, url_mappings, custom_actions) {
    var Resource, a, action, actions, c;
    actions = fn.extend({}, DEFAULT_ACTIONS, custom_actions);
    Resource = (function() {
      function Resource() {}

      return Resource;

    })();
    action = function(name, action_config) {
      var action_mappings, action_url, handler, has_body, method, transforms;
      action_url = action_config.url || resource_url;
      action_mappings = fn.extend({}, url_mappings, action_config.params);
      method = (action_config.method || "GET").toUpperCase();
      has_body = action_config.has_body === true;
      transforms = action_config.transform || {};
      handler = function(data, callback) {
        var body_data, error, headers, k, key, leftover, loaded, mapping_data, mapping_keys, query_str, request_url, value, xhr;
        mapping_data = fn.extractObjectMappings(data, action_mappings);
        mapping_keys = (function() {
          var results;
          results = [];
          for (k in mapping_data) {
            results.push(k);
          }
          return results;
        })();
        leftover = fn.omit(data, mapping_keys);
        query_str = fn.queryString(leftover);
        request_url = fn.transformUrl(action_url, mapping_data);
        headers = fn.extend({}, DEFAULT_HEADERS, action_config.headers);
        xhr = fn.xhr();
        if (query_str !== null && !has_body) {
          request_url = [request_url, query_str].join("?");
        }
        for (key in headers) {
          value = headers[key];
          if (isFunction(value)) {
            value = value(data);
          }
          if (value !== void 0) {
            xhr.setRequestHeader(key, value);
          }
        }
        xhr.open(method, request_url, true);
        loaded = function() {
          var response, result, status_code, status_text;
          status_text = xhr.statusText;
          status_code = xhr.status;
          response = xhr.response ? xhr.response : xhr.responseText;
          headers = xhr.getAllResponseHeaders();
          result = defaultResponseTransform(response, headers);
          if (isFunction(transforms.response)) {
            result = transforms.response(response);
          }
          if (isSuccess(status_code)) {
            return callback(false, result, xhr);
          }
          return callback({
            response: response
          }, void 0, xhr);
        };
        error = function() {
          return callback({
            response: null
          }, void 0, xhr);
        };
        xhr.onload = loaded;
        xhr.onerror = error;
        if (!has_body) {
          return xhr.send();
        }
        body_data = defaultRequestTransform(data);
        if (isFunction(transforms.request)) {
          body_data = transforms.request(data);
        }
        xhr.send(body_data);
        return true;
      };
      return handler;
    };
    for (a in actions) {
      c = actions[a];
      Resource[a] = action(a, c);
    }
    return Resource;
  };

  Flyby.fn = fn;

  if (this.define) {
    this.define([], function() {
      return Flyby;
    });
  } else {
    this.Flyby = Flyby;
  }

}).call(this);
