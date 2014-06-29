var mapspaceApp = angular.module('mapspaceApp', ['ui.router', 'firebase']);


mapspaceApp.config(['$stateProvider', '$urlRouterProvider', function ($stateProvider, $urlRouterProvider) {

  $urlRouterProvider.otherwise('/');

  $stateProvider
    .state('/', {
        url: '/',
        templateUrl: 'templates/home.html',
        controller: 'HomeController'
    })
    .state('spaces', {
        url: '/spaces',
        templateUrl: 'templates/spaces.html',
        controller: 'SpacesController'
    })
    .state('space', {
        url: '/spaces/:id',
        templateUrl: 'templates/space.html',
        controller: 'SpaceController'
    })
  ;

}]);
