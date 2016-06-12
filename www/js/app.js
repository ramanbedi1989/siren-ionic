// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
var sirenApp = angular.module('sirenApp', ['ionic', 'ui.router', 'ngCordova'])

.run(function($ionicPlatform, $rootScope, $ionicPopup, $state, appConstants, $cordovaLocalNotification, LocalStorageService, AuthenticationService) {
  $ionicPlatform.ready(function() {
    if(window.cordova && window.cordova.plugins.Keyboard) {
      // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
      // for form inputs)
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);

      // Don't remove this line unless you know what you are doing. It stops the viewport
      // from snapping when text inputs are focused. Ionic handles this internally for
      // a much nicer keyboard experience.
      cordova.plugins.Keyboard.disableScroll(true);
    }
    if(window.StatusBar) {
      StatusBar.styleDefault();
    }

    $rootScope.userSignedIn = function(){
      return AuthenticationService.isUserSignedIn();
    }

    $rootScope.signOutUser = function(){
      AuthenticationService.signOutUser();
      $state.go('signin');
    }

    if(window.PushNotification){
      $rootScope.pushNotification = PushNotification.init({ "android": { "senderID": appConstants.senderId } });

      $rootScope.pushNotification.on('registration', function(data) {
        LocalStorageService.set(appConstants.registrationId, data.registrationId);
      });

      $rootScope.pushNotification.on('notification', function(data) {
        console.log('notification received', data);
        if(AuthenticationService.isUserSignedIn() && AuthenticationService.isUserAuthorized(data.additionalData.category)){
          if(data.additionalData.donot_popup === undefined){
            $cordovaLocalNotification.add({
              id: Math.ceil(Math.random() * 10000),
              date: new Date(),
              message: data.message,
              title: data.title,
              autoCancel: true,
              sound: null,
              data: data
            }).then(function () {
              console.log("The notification has been set");
            });
          }
          $rootScope.updateEventsFromNotification(data);
        }
      });

      $rootScope.$on('$cordovaLocalNotification:click', function(event, notification, state) {
        console.log(event, notification, state);
        $rootScope.updateEventsFromNotification(JSON.parse(notification.data));
      });

      $rootScope.updateEventsFromNotification = function(data){
        if(data.additionalData.category == "healer"){
          if(data.additionalData.purpose === undefined){
            $state.go('helpView', { category: data.additionalData.category, ready: true, location: data.additionalData.location, emergency_route_id: data.additionalData.emergency_route_id});
          }else if(data.additionalData.purpose == "notifyLightsChanged"){
            $rootScope.$emit('lights:changed', {
              lightsLocationId: data.additionalData.lights_location_id
            });
          }
        }else if(data.additionalData.category == "sufferer"){
          if(data.additionalData.current_location_id === undefined){
            console.log("going to map view with data ", data);
            $state.go('mapView', {category: data.additionalData.category, emergency_route_id: data.additionalData.emergency_route_id});  
          }else if(data.additionalData.purpose == "notifyLocationChanged"){
            $rootScope.$emit('location_id:changed', {
              currentLocationId: data.additionalData.current_location_id
            });
          }
        }else if(data.additionalData.category == "mediator"){
          $state.go('helpView', { category: data.additionalData.category, ready: true, location: data.additionalData.location, emergency_route_id: data.additionalData.emergency_route_id, light_location_id: data.additionalData.light_location_id });
        }
      };

      $rootScope.pushNotification.on('error', function(e) {
        console.log("error", e);
          // e.message
      });
    }
  });
  $rootScope.showMessage = function(header, body, scope, changeView, viewName){
    $ionicPopup.show({
      title: header,
      subTitle: body,
      scope: scope,
      buttons: [
        { 
          text: 'OK',
          onTap: function(e){
            if(changeView){
              $state.go(viewName);
            }
          } 
        }
      ]
    });
  }
});

sirenApp.factory('customInterceptor',['$timeout','$injector', '$q',function($timeout, $injector, $q) {
  
  var requestInitiated;

  function showLoadingText() {
    $injector.get("$ionicLoading").show({
      template: 'Loading...',
      animation: 'fade-in',
      showBackdrop: true
    });
  };
  
  function hideLoadingText(){
    $injector.get("$ionicLoading").hide();
  };

  return {
    request : function(config) {
      requestInitiated = true;
      console.log('config is', config);
      if(config.data === undefined || config.data.location_id === undefined){
        showLoadingText();
      }
      console.log('Request Initiated with interceptor');
      return config;
    },
    response : function(response) {
      requestInitiated = false;
        
      // Show delay of 300ms so the popup will not appear for multiple http request
      $timeout(function() {

        if(requestInitiated) return;
        hideLoadingText();
        console.log('Response received with interceptor');

      },300);
      
      return response;
    },
    requestError : function (err) {
      hideLoadingText();
      console.log('Request Error logging via interceptor');
      return err;
    },
    responseError : function (err) {
      hideLoadingText();
      console.log('Response error via interceptor');
      return $q.reject(err);
    }
  }
}]);

sirenApp.config(function($stateProvider, $urlRouterProvider, $httpProvider) {
  $httpProvider.interceptors.push('customInterceptor');
  $urlRouterProvider.otherwise('/');
  $stateProvider
    .state('signin', {
      url: '/',
      templateUrl: 'signin.html',
      controller: 'SignInCtrl',
      onEnter: function($state, AuthenticationService){
        if(AuthenticationService.isUserSignedIn()){
          var category = AuthenticationService.getSignedInUserCategory();
          if(category !== "sufferer"){
            $state.go('helpView', { category: category, ready: false });
          }else{
            $state.go('gridView');
          }
        }
      }
    })
    .state('mapView', {
      cache: false,
      url: '/mapView',
      templateUrl: 'mapView.html',
      controller: 'MapViewCtrl',
      onEnter: function($state, AuthenticationService){
        if(!AuthenticationService.isUserSignedIn()){
          $state.go('signin');
        }
      },
      params: {
        category: "sufferer",
        emergency_route_id: null
      }
    })
    .state('helpView', {
      url: '/helpView',
      templateUrl: 'helpView.html',
      controller: 'HelpViewCtrl',
      onEnter: function($state, AuthenticationService){
        if(!AuthenticationService.isUserSignedIn()){
          $state.go('signin');
        }
      },
      params:{
        category: "sufferer",
        ready: false,
        location: "",
        emergency_route_id: null,
        light_location_id: null
      }
    })
    .state('registerView', {
      url: '/register',
      templateUrl: 'register.html',
      controller: 'RegisterViewCtrl',
      onEnter: function($state, AuthenticationService){
        if(AuthenticationService.isUserSignedIn()){
          var category = AuthenticationService.getSignedInUserCategory();
          if(category !== "sufferer"){
            $state.go('helpView', { category: category, ready: false });
          }else{
            $state.go('gridView');
          }
        }
      }
    })
    .state('gridView', {
      url: '/gridView',
      templateUrl: 'gridView.html',
      controller: 'GridViewCtrl',
      onEnter: function($state, AuthenticationService){
        if(!AuthenticationService.isUserSignedIn()){
          $state.go('signin');
        }
      }
    });
  
  $urlRouterProvider.otherwise("/");
  
});

sirenApp.constant("appConstants", {
  vehicleTimeout: 2000,
  numberOfTrafficLights: 3,
  senderId: "894719826632",
  registrationId: "registrationId",
  signedInUserDetails: "signedInUserDetails",
  locationOptions: {timeout: 10000, enableHighAccuracy: true},
  serverUrl: "https://siren-app.herokuapp.com",
  registerUserUrl: "/api/v1/users",
  signinUserUrl: "/api/v1/sessions",
  showEmergencyRouteUrl: "/api/v1/emergencies",
  createOriginUrl: "/api/v1/emergencies/:id/create_origin",
  createDestinationUrl: "/api/v1/emergencies/create_destination",
  updateCurrentLocationUrl: "/api/v1/emergencies/:id/update_location",
  switchTrafficLightUrl: "/api/v1/emergencies/:id/switch_traffic_light",
  mapOptions: {
    zoom: 15
  }
});


sirenApp.controller('SignInCtrl', function($scope, $state, PushNotificationService, AuthenticationService, LocalStorageService, appConstants) {
  $scope.loginDetails = {};
  $scope.signInUser = function(){
    AuthenticationService.signinUser($scope.loginDetails.email, $scope.loginDetails.password).then(function(data){
      $scope.loginDetails.email = "";
      $scope.loginDetails.password = "";
      var user = data.data;
      LocalStorageService.set(appConstants.signedInUserDetails, { authToken: user.auth_token, category: user.category });
      if(user.category !== "sufferer"){
        $state.go('helpView', { category: user.category, ready: false });
      }else{
        $state.go('gridView');
      }
    }, function(error){
      console.log(error);
    });
  } 
  $scope.openRegistration = function(){
    $state.go('registerView');
  }   
});

sirenApp.controller('RegisterViewCtrl', function($scope, $state, PushNotificationService, AuthenticationService) {
  var allCategories = [
    {id: "sufferer", name: "Sufferer"},
    {id: "mediator", name: "Traffic Police"},
    {id: "healer", name: "Rescuer"}
  ];
  $scope.categoryData = {
    selectedCategory: allCategories[0],
    availableCategories: allCategories
  };
  $scope.registerationDetails = {};
  $scope.registerUser = function(){
    AuthenticationService.registerUser($scope.registerationDetails.email, $scope.registerationDetails.password, $scope.registerationDetails.password_confirmation, $scope.categoryData.selectedCategory.id).then(function(data){
      $scope.registerationDetails.email = "";
      $scope.registerationDetails.password = "";
      $scope.registerationDetails.password_confirmation = "";
      $scope.categoryData.selectedCategory = allCategories[0];
      $state.go('signin');
    }, function(error){
      console.log(error);
    });
  }    
});

sirenApp.controller('HelpViewCtrl', function($scope, $state, EmergencyRouteService) {
    $scope.helpMessage = "Wait for notification";
    $scope.category = $state.params.category;
    $scope.ready = $state.params.ready;
    $scope.location = $state.params.location;
    $scope.light_location_id = $state.params.light_location_id;
    $scope.emergency_route_id = $state.params.emergency_route_id;
    $scope.topBannerMessage = "";
    if($scope.category == "healer" && $scope.ready){
      $scope.topBannerMessage = "Help required at "+$scope.location;
      $scope.helpMessage = "Click to accept";
    }else if($scope.category == "mediator" && $scope.ready){
      $scope.topBannerMessage = "Please switch traffic light green at "+$scope.location;
      $scope.helpMessage = "Click to accept";
    }
    $scope.showGrid = function(){
      if($scope.category == "healer" && $scope.ready && $scope.emergency_route_id !== null){
        EmergencyRouteService.createOrigin($scope.emergency_route_id, 12, 12).then(function(data){
          $state.go('mapView', {category: "healer", emergency_route_id: $scope.emergency_route_id});
        });
      }else if($scope.category == "mediator" && $scope.ready && $scope.emergency_route_id !== null && $scope.light_location_id !== null){
        EmergencyRouteService.switchTrafficLight($scope.emergency_route_id, $scope.light_location_id).then(function(data){
          $rootScope.showMessage('Lights Change Successful', 'thanks', $scope, false, 'gridView');
          $state.go('helpView', { category: "mediator", ready: false });
        });
      }
    }
});

sirenApp.controller('GridViewCtrl', function($scope, $state, $rootScope, $cordovaGeolocation, EmergencyRouteService, appConstants){
  $scope.showMap = function(mapType){
    $rootScope.currentMapType = mapType;
    $cordovaGeolocation.getCurrentPosition(appConstants.locationOptions).then(function(position){
      var latitude = position.coords.latitude;
      var longitude = position.coords.longitude;
      EmergencyRouteService.createDestination(latitude, longitude).then(function(data){
        var emergency_route_id = data.emergency_route_id;
        $state.go('helpView', {category: "sufferer", emergency_route_id: emergency_route_id, ready: false});
      });
    }, function(error){
      $rootScope.showMessage('Location Error', 'Could not get location, please enable location and try again.', 
        $scope, false, 'gridView');
    });
  };
});


sirenApp.service('PushNotificationService', function(LocalStorageService, appConstants){
  return {
    getDeviceRegistrationId: function(){
      return LocalStorageService.get(appConstants.registrationId);
    }
  };
});

sirenApp.service('AuthenticationService', function($http, appConstants, PushNotificationService, LocalStorageService){
  return {
    registerUser: function(email, password, password_confirmation, category){
      return $http.post(appConstants.serverUrl+appConstants.registerUserUrl, {
        email: email,
        password: password,
        password_confirmation: password_confirmation,
        category: category,
        device_id: PushNotificationService.getDeviceRegistrationId()
      });
    },
    signinUser: function(email, password){
      return $http.post(appConstants.serverUrl+appConstants.signinUserUrl, {
        email: email,
        password: password,
        device_id: PushNotificationService.getDeviceRegistrationId()
      });
    },
    signOutUser: function(){
      LocalStorageService.set(appConstants.signedInUserDetails, null);
    },
    getSignedInUserCategory: function(){
      var userDetails = LocalStorageService.get(appConstants.signedInUserDetails);
      if(userDetails != undefined && userDetails != null){
        return userDetails.category;
      }else{
        return null;
      }
    },
    getSignedInUserAuthToken: function(){
      var userDetails = LocalStorageService.get(appConstants.signedInUserDetails);
      if(userDetails != undefined && userDetails != null){
        return userDetails.authToken;
      }else{
        return null;
      }
    },
    isUserSignedIn: function(){
      var userDetails = LocalStorageService.get(appConstants.signedInUserDetails);
      if(userDetails != undefined && userDetails != null){
        return true;
      }else{
        return false;
      }
    },
    isUserAuthorized: function(category){
      var userDetails = LocalStorageService.get(appConstants.signedInUserDetails);
      if(userDetails != undefined && userDetails != null && userDetails.category == category){
        return true;
      }else{
        return false;
      }
    }
  };
});

sirenApp.service('EmergencyRouteService', function($http, appConstants, AuthenticationService){
  return {
    getEmergencyRoute: function(emergencyRouteId){
      return $http.get(appConstants.serverUrl + appConstants.showEmergencyRouteUrl + "/" + emergencyRouteId, {
        headers: {'Authorization': AuthenticationService.getSignedInUserAuthToken()}
      });
    },
    createDestination: function(latitude, longitude){
      return $http.post(appConstants.serverUrl + appConstants.createDestinationUrl, {
        latitude: latitude,
        longitude: longitude
      }, {
        headers: {'Authorization': AuthenticationService.getSignedInUserAuthToken()}
      });
    },
    createOrigin: function(emergencyRouteId, latitude, longitude){
      return $http.post(appConstants.serverUrl + appConstants.createOriginUrl.replace(":id", emergencyRouteId), {
        latitude: latitude,
        longitude: longitude
      }, {
        headers: {'Authorization': AuthenticationService.getSignedInUserAuthToken()}
      });
    },
    updateCurrentLocation: function(emergencyRouteId, locationId){
      return $http.put(appConstants.serverUrl + appConstants.updateCurrentLocationUrl.replace(":id", emergencyRouteId), {
        location_id: locationId
      }, {
        headers: {'Authorization': AuthenticationService.getSignedInUserAuthToken()}
      });
    },
    switchTrafficLight: function(emergencyRouteId, locationId){
      return $http.put(appConstants.serverUrl + appConstants.switchTrafficLightUrl.replace(":id", emergencyRouteId), {
        location_id: locationId
      }, {
        headers: {'Authorization': AuthenticationService.getSignedInUserAuthToken()}
      });
    }
  };
});

sirenApp.service('LocalStorageService', function($window){
  return {
    get: function(item){
      return JSON.parse($window.localStorage.getItem(item));
    },
    set: function(item, value){
      $window.localStorage.setItem(item, JSON.stringify(value));
    }
  };
});

sirenApp.controller('MapViewCtrl', function($scope, $state, $ionicHistory, $cordovaGeolocation, $timeout, $rootScope, appConstants, EmergencyRouteService) {
  $scope.currentDrivePosition = 0;

  $scope.safeApply = function(fn) {
    var phase = this.$root.$$phase;
    if(phase == '$apply' || phase == '$digest') {
      if(fn && (typeof(fn) === 'function')) {
        fn();
      }
    } else {
      this.$apply(fn);
    }
  };

  $scope.addMarkerToMap = function(postion, infoWindowContent, icon_name){
    var marker = new google.maps.Marker({
      position: postion,
      title: infoWindowContent,
      icon: 'http://maps.google.com/mapfiles/ms/icons/'+icon_name+'.png'
    });
    var infoWindow = new google.maps.InfoWindow({
      content: infoWindowContent
    });
    marker.addListener('click', function() {
      infoWindow.open($scope.map, this);
    });
    marker.setMap($scope.map);
    return marker;
  };

  $scope.startDriving = function(){
    if($scope.currentDrivePosition < $scope.pathCoordinates.length){
      $timeout(function(){
        var updatedDrivingPosition = $scope.currentDrivePosition + 1;
        var currentTrafficLight = $scope.trafficLights[$scope.currentDrivePosition];
        EmergencyRouteService.updateCurrentLocation($state.params.emergency_route_id, $scope.locationIds[$scope.currentDrivePosition]).then(function(data){
          if($scope.currentDrivePosition != 0){
            $scope.currentMarker.setMap(null);
          }
          var currentMarkerPosition = $scope.pathCoordinates[$scope.currentDrivePosition];
          $scope.currentMarker = new google.maps.Marker({
            position: currentMarkerPosition,
            title: ($rootScope.currentMapType || "Helper")+"'s Current Position",
            icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
          });
          $scope.currentInfoWindow = new google.maps.InfoWindow({
            content: ($rootScope.currentMapType || "Helper")+"'s Current Position"
          });
          $scope.currentMarker.addListener('click', function() {
            $scope.currentInfoWindow.open($scope.map, this);
          });
          $scope.currentMarker.setMap($scope.map);
          
          
          if(currentTrafficLight == undefined || currentTrafficLight.light_status){
            $scope.currentDrivePosition = updatedDrivingPosition;
            $scope.startDriving();
          }
        });
      }, appConstants.vehicleTimeout);
    }
  };


  $scope.updatePosition = function(){
    if($scope.currentDrivePosition < $scope.pathCoordinates.length){
      if($scope.currentDrivePosition != 0){
        $scope.currentMarker.setMap(null);
      }
      var currentMarkerPosition = $scope.pathCoordinates[$scope.currentDrivePosition];
      $scope.currentMarker = new google.maps.Marker({
        position: currentMarkerPosition,
        title: ($rootScope.currentMapType || "Fire Brigade")+"'s Current Position",
        icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
      });
      $scope.currentInfoWindow = new google.maps.InfoWindow({
        content: ($rootScope.currentMapType || "Fire Brigade")+"'s Current Position"
      });
      $scope.currentMarker.addListener('click', function() {
        $scope.currentInfoWindow.open($scope.map, this);
      });
      $scope.currentMarker.setMap($scope.map);
    }
  };

  EmergencyRouteService.getEmergencyRoute($state.params.emergency_route_id).then(function(data){
    $timeout(function(){
      $scope.pathCoordinates = [];
      $scope.locationIds = [];
      $scope.trafficLights = {};
      $scope.origin = null;
      $scope.destination = null;
      data.data.locations.forEach(function(location){
        if(location.location_type === "destination"){
          $scope.destination = new google.maps.LatLng(parseFloat(location.latitude), parseFloat(location.longitude));
          $scope.pathCoordinates[data.data.locations.length - 1] = $scope.destination;
          $scope.locationIds[data.data.locations.length - 1] = location.id;
        }else if(location.location_type === "origin"){
          $scope.origin = new google.maps.LatLng(parseFloat(location.latitude), parseFloat(location.longitude));
          $scope.pathCoordinates[0] = $scope.origin;
          $scope.locationIds[0] = location.id;
        }else{
          var currentLocation = new google.maps.LatLng(parseFloat(location.latitude), parseFloat(location.longitude))
          if(location.location_type == "lights"){
            $scope.trafficLights[location.loc_index + 1] = { location: currentLocation, light_status: location.light_status };
          }
          $scope.pathCoordinates[location.loc_index + 1] = currentLocation;
          $scope.locationIds[location.loc_index + 1] = location.id;
        }
      });
      var latitudeMean = ($scope.origin.lat() + $scope.destination.lat()) / 2;
      var longitudeMean = ($scope.origin.lng() + $scope.destination.lng()) / 2;
      var mapOptions = appConstants.mapOptions;
      Object.assign(mapOptions, {center: {lat: latitudeMean, lng: longitudeMean}, mapTypeId: google.maps.MapTypeId.ROADMAP});
      //var currentView = document.querySelector('ion-view[nav-view="active"]');
      var oldMap = document.getElementById('emergencyMap');
      var mapParent = oldMap.parentNode;
      oldMap.remove();
      var newMap = document.createElement('div');
      newMap.setAttribute('id', 'emergencyMap');
      mapParent.appendChild(newMap);
      $scope.map = new google.maps.Map(newMap, mapOptions);
      google.maps.event.addListenerOnce($scope.map, 'idle', function(){
        console.log('tiles loaded now');
        $scope.safeApply(function(){
          $scope.drivingPath = new google.maps.Polyline({
            path: $scope.pathCoordinates,
            geodesic: true,
            strokeColor: '#FF0000',
            strokeOpacity: 1.0,
            strokeWeight: 2
          });
          $scope.drivingPath.setMap($scope.map);
          $scope.addMarkerToMap($scope.origin, "Origin", "yellow-dot");
          $scope.addMarkerToMap($scope.destination, "Destination", "yellow-dot");
          Object.keys($scope.trafficLights).forEach(function(key){
            var trafficLight = $scope.trafficLights[key].location;
            $scope.trafficLights[key].marker = $scope.addMarkerToMap(trafficLight, "Traffic Light - Red", "red-dot");
          });
          if($state.params.category === "healer"){
            $scope.startDriving();
          }
        });
      });
      $scope.bounds = new google.maps.LatLngBounds();
      $scope.bounds.extend($scope.origin);
      $scope.bounds.extend($scope.destination);
      $scope.map.panToBounds($scope.bounds);
      $scope.map.setCenter({lat: latitudeMean, lng: longitudeMean});
      $scope.map.fitBounds($scope.bounds);
      console.log('calling tiles loaded');
    }, 10);
  });

  $rootScope.$on('location_id:changed', function(event, data){
    $scope.currentDrivePosition = $scope.locationIds.indexOf(parseInt(data.currentLocationId));
    $scope.updatePosition();
  });

  $rootScope.$on('lights:changed', function(event, data){
    $scope.currentDrivePosition = $scope.locationIds.indexOf(parseInt(data.lightsLocationId));
    var trafficLight = $scope.trafficLights[$scope.currentDrivePosition];
    trafficLight.light_status = true;
    trafficLight.marker.setMap(null);
    trafficLight.marker = $scope.addMarkerToMap($scope.trafficLights[$scope.currentDrivePosition].location, "Traffic Light - Green", "green-dot");
    $scope.startDriving();
  });
});
