Configuration._canEditDefault = _.constant(false);
Configuration.canEditDefault = function (func) {
  check(func, Function);
  Configuration._canEditDefault = func;
};
