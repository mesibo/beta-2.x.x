//controller.js

/** Copyright (c) 2022 Mesibo
 * https://mesibo.com
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the terms and condition mentioned
 * on https://mesibo.com as well as following conditions are met:
 *
 * Redistributions of source code must retain the above copyright notice, this
 * list of conditions, the following disclaimer and links to documentation and
 * source code repository.
 *
 * Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 *
 * Neither the name of Mesibo nor the names of its contributors may be used to
 * endorse or promote products derived from this software without specific prior
 * written permission.
 *
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 * Documentation
 * https://mesibo.com/documentation/
 *
 * Source Code Repository
 * https://github.com/mesibo/messenger-javascript
 *
 *
 */



//The number of messages loaded into the message area in one read call
const MAX_MESSAGES_READ = 100;

//The number of users to be loaded (summary)
const MAX_MESSAGES_READ_SUMMARY = 100;

const MAX_FILE_SIZE_SUPPORTED = 10000000;




var mesiboWeb = angular.module('MesiboWeb', []);

mesiboWeb.directive('imageonload', function() {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      if(!scope.$last)
        return;

      element.bind('load', function() {
        MesiboLog("image load")
        scrollToEnd(true);
      });

      element.bind('error', function(){
        ErrorLog('Error loading image');
      });                                   
    }
  };
});

mesiboWeb.directive('videoonload', function() {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      if(!scope.$last)
        return;

      element.bind('loadeddata', function() {
        MesiboLog("video loadeddata");
        scrollToEnd(true);
      });

      element.bind('error', function(){
        ErrorLog('Error loading video');
      });                                   
    }
  };
});


mesiboWeb.directive('onFinishRender', function($timeout) {
  return {
    link: function(scope, element, attr) {
      if (scope.$last === true) {
        $timeout(function() {
          scope.$emit(attr.onFinishRender);
        });
      }
    }
  };
});


mesiboWeb.controller('AppController', ['$scope', '$window', '$anchorScroll', function ($scope, $window, $anchorScroll) {

	console.log("AppController loaded");
	var token = getLoginToken();
	if(!token || token.length < 16) {
		window.location.replace("index.html");
		return;
	}

	$scope.isConnected = false;
	$scope.isLoggedIn = false;
	$scope.connection_status = '';
	$scope.summarySession = null;
	$scope.msg_read_limit_reached = false;
	$scope.users_synced = false;
	$scope.scroll_messages = null;
	$scope.is_shared = false;
	$scope.new_contact_name = '';
	$scope.new_contact_phone = '';

	$scope.messages = [];

	$scope.selected_user = null;
	$scope.selected_user_count = 0; 

	$scope.forward_message = null;

	$scope.mesibo = null; 

	//Main UI
	$scope.display_profile = null;
	$scope.membersList = [];
	$scope.users_panel_show = false;
	$scope.message_area_show = false;

	//Input Area
	$scope.input_message_text = "";
	$scope.link_preview = null;
	$scope.self_profile_name = "";

	//Calls  
	$scope.is_answer_call = false;
	$scope.is_video_call = false;
	$scope.is_voice_call = true;
	$scope.call_status = "Call Status: ";
	$scope.call_alert_message = "";

	//Files
	$scope.selected_file = {};
	$scope.input_file_caption = "";

	//Recorder
	$scope.recorder = null;

	$scope.MAX_MEDIA_WIDTH = '320px';
	$scope.MAX_MEDIA_HEIGHT = '240px';

	$scope.MIN_MEDIA_WIDTH = '160px';
	$scope.MIN_MEDIA_HEIGHT = '120px';

	$scope.refresh = function(){
		$scope.$applyAsync();
	}

	$scope.scrollToLastMsg = function() {
		$scope.$$postDigest(function () {
			//$anchorScroll("messages_end");
			scrollToEnd(false);
		});
	}

	$scope.updateMessagesScroll = function(){

	}

	$scope.$on('onMessagesRendered', function(e) {
		MesiboLog("onMessagesRendered");
		if($scope.scroll_messages && 
			$scope.scroll_messages.scrollTop == 0
			&& $scope.messageSession
			&& $scope.messageSession.getMessages().length){
			MesiboLog('onMessagesRendered');
		}

		$scope.scrollToLastMsg();

	});


	angular.element(document.getElementById('messages')).bind('scroll', function(e){
		//MesiboLog("scrolling");
		$scope.checkScroll(e);	
	})


	$scope.checkScroll = function(e) {
		if(!(e && e.target))
			return;

		$scope.scroll_messages = e.target;

		if($scope.scroll_messages.scrollTop == 0){
			if(!($scope.messageSession 
				&& $scope.messageSession.getMessages)){
				return;
			}

			var m = $scope.messageSession.getMessages().length;
			if(m == 0){
				return;
			}

			MesiboLog("checkScroll: Scrolled to top!");
			//Load more messages
			$scope.messageSession.read(MAX_MESSAGES_READ);
		}

	}


	$scope.getMesibo = function(){
		return $scope.mesibo;
	}

	$scope.showAvailableUsers = function() {
		MesiboLog('showAvailableUsers');
		$scope.users_panel_show = true;

		//prompt to add a contact if no contacts available
		if(!$scope.hasContacts())
			$scope.showContactForm();

		$scope.refresh();   
	}

	$scope.hideAvailableUsers = function() {
		MesiboLog('hideAvailableUsers');
		$scope.users_panel_show = false;
		$scope.refresh();
	}

	$scope.getContacts = function(){
		var c = $scope.mesibo.getSortedProfiles();
		return c;
	}
	
	$scope.hasContacts = function(){
		var c = $scope.getContacts();
		if(c && c.length) return true;
		return false;
	}

	// [OPTIONAL] refer to the comment below
	$scope.Mesibo_onGroupMembers = function(p, members) {
		$scope.membersList = members;
		$scope.refresh();
	}

	$scope.showProfile = function(p) {
		if(!p)
			return;
		if(p.isSelfProfile()) {
			$scope.self_profile_name = p.getName();
		}
		$scope.display_profile = p; 
		$scope.membersList = [];
		if(p.getGroupId() > 0) {
			// you can either pass a function or listenr, this code list 
			// both teh syntax for reference
			if(true) {
				p.getMembers(0, false, $scope);
			} else {
				p.getMembers(0, false, function(p, members) {
					$scope.membersList = members;
					$scope.refresh();
				});
			}
		}
		$scope.refresh();
	};
	
	$scope.editProfile = function() {
		$scope.showProfile($scope.getSelfProfile());
	}
	
	$scope.showProfileFromMessage = function(m) {
		var p = $scope.getProfileFromMessage(m);
		if(!p)
			return;
		$scope.showProfile(p); 

		$scope.refresh();
	};

	$scope.hideProfileSettings = function() {
		$scope.display_profile = null; 
		$scope.membersList = [];
		$scope.refresh();
	};

	$scope.hideForwardList = function() {
		$scope.forward_message = null; 
		$scope.refresh();
	};

	//fm is the message to be forwarded
	$scope.showForwardList = function(fm){
		if(!fm)
			return;

		$scope.forward_message = fm;
		$scope.refresh();
	}


	$scope.isSent = function(msg){
		return isSentMessage(msg.status);
	}

	$scope.isReceived = function(msg){
		return !isSentMessage(msg.status);
	}

	$scope.isMessageVisible = function(m) {
		return true;
		if(m.message || m.isDeleted() || $scope.isFileMsg(m)) return true;
		return false;
	}
	
	$scope.getMessageText = function(m) {
		if(m.isDeleted()) return "This message was deleted";
		if(m.isDate()) 
			return m.getDateVerbal(true, "Today", "Yesterday");

		if(!m.isCall()) 
			return m.message;

		var type = m.isVideoCall()?"Video":"Audio";
		var dir = "Missed";
		if(m.isIncomingCall()) dir = "Incoming";
		else if(m.isOutgoingCall()) dir = "Outgoing";
		return dir + " " + type + " call at " + m.getTime();
	}
	
	$scope.getLastSeen = function(p) {
		if(!p) return -1;
		return p.getLastSeen();
	}
	
	$scope.isBlocked = function(p) {
		if(!p) return false;
		this.getLastSeen(p);
		return p.isBlocked();
	}
	
	$scope.BlockUser = function(p) {
		var isBlocked = p.isBlocked();
		p.setContact(true);
		p.subscribe(true);
		p.block(!isBlocked);
		p.save();
		return true;
	}
	
	$scope.generateMessageArea = function(contact){
		MesiboLog(contact);

		if($scope.selected_user && $scope.selected_user == contact){
			return 0;
		}

		$scope.selected_user = contact;

		// Stop read session for previous user 
		if($scope.messageSession && typeof $scope.messageSession.stop == 'function')
			$scope.messageSession.stop();

		$scope.messageSession = null;
		$scope.scroll_messages = null;
		$scope.sessionReadMessages($scope.selected_user, MAX_MESSAGES_READ);			
		$scope.message_area_show = true;
		$scope.refresh();
		$scope.scrollToLastMsg();
	}

	$scope.onMemberClick = function(p) {
		$scope.hideProfileSettings(); 
		if(p.isSelfProfile()) return;
		$scope.generateMessageArea(p);
		$scope.refresh();
	}

	$scope.setSelectedUser = function(user){
		$scope.selected_user = user;
		$scope.refresh();
	}

	$scope.showContactForm = function(){
		$('#ModalContactForm').modal("show");
	}

	$scope.promptAddContact = function(){
		$('#promptAddContact').modal("show");
	}

	$scope.closePromptAddContact = function(){
		$('#promptAddContact').modal("hide");
	}

	$scope.hideContactForm = function(){
		$('#ModalContactForm').modal("hide");
		if(document.getElementById('contact-address'))
			document.getElementById('contact-address').value = "";

		if(document.getElementById('contact-name'))
			document.getElementById('contact-name').value = "";

	}

	$scope.addContact = function(){
		//cAddress = document.getElementById('contact-address').value;
		//cGroupid = document.getElementById('contact-group-id').value;
		if($scope.new_contact_phone.length < 8){
			alert("Enter valid phone number / address or a valid group id");	
			return;
		}

		if($scope.new_contact_phone[0] == "+")
			$scope.new_contact_phone = $scope.new_contact_phone.slice(1);

		var c = $scope.mesibo.getProfile($scope.new_contact_phone, 0);

		$scope.hideContactForm();
		$scope.new_contact_name = '';
		$scope.new_contact_phone = '';

		//TBD: After adding new contact, select that
		$scope.generateMessageArea(c);

		$scope.refresh();
	}


	$scope.isValidPreview = function(type){
		MesiboLog("isValidPreview", type);

		if(type == "image"){
			var e = document.getElementById("image-preview");
			if(!e)
				return;

			MesiboLog(e);
			var fname = e.src;

			MesiboLog(fname);
			if(!fname)
				return;

			return isValidImage(fname);
		}

		if(type == "video"){
			var e = document.getElementById("video-preview");
			if(!e)
				return;

			var fname = e.src;
			if(!fname)
				return;

			return isValidVideo(fname);

		}

		return false;
	}
	
	$scope.getProfileFromMessage = function(m) {
		if(!m) return null;
		var p = m.groupProfile;
		if(!p) p = m.profile;
		return p;
	}
	
	$scope.hasPicture = function(m) {
		var p = $scope.getProfileFromMessage(m);
		if(!p) return false;
		var pic = p.getThumbnail();
		if(pic && pic.length > 10) return true;
		return false;
	}

	$scope.getFirstLetter = function(m) {
		var p = $scope.getProfileFromMessage(m);
		if(!p) return '*';
		var name = p.getNameOrAddress('');
		return name[0];
	}
	
	$scope.getLetterColor = function(m) {
		var p = $scope.getProfileFromMessage(m);
		var colors = ["#e6d200", "#f58559", "#f9a43e", "#e4c62e",
		            "#67bf74", "#59a2be", "#2093cd", "#ad62a7"];
		if(!p) return colors[0];
		var name = p.getNameOrAddress('+');
		var l = name.length;
		if(!l) return colors[0];
		var c = name.charCodeAt(l-1)&7;
		return colors[c];
	}

	$scope.getPictureFromMessage = function(m) {
		var p = $scope.getProfileFromMessage(m);
		return $scope.getUserPicture(p);
	}
	
	$scope.getNameFromMessage = function(m) {
		var p = $scope.getProfileFromMessage(m);
		return $scope.getUserName(p);
	}
	
	$scope.getSenderNameFromMessage = function(m) {
		if(null == m || null == m.profile) {
			return ''; // data object
		}
		return m.profile.getNameOrAddress("+");
	}

	$scope.getUserPicture = function(user){
		if(!user) return '';
		// MesiboLog(user);
		var pic = user.getThumbnail();
		if(pic && pic.length > 10) return pic;

		return user.getGroupId() ? MESIBO_DEFAULT_GROUP_IMAGE:MESIBO_DEFAULT_PROFILE_IMAGE; 
	} 

	$scope.getProfileImage = function(user){
		if(!user) return '';
		// MesiboLog(user);
		var pic = user.getImageOrThumbnail();
		if(pic && pic.length > 10) return pic;

		return user.getGroupId() ? MESIBO_DEFAULT_GROUP_IMAGE:MESIBO_DEFAULT_PROFILE_IMAGE; 
	} 

	$scope.getUserName = function(user){
		if(!user) return "";
		return user.getNameOrAddress('+');
	}
	
	$scope.getLastSeen = function(user){
		if(!user) return "";
		var lastseen = user.getLastSeen();
		if(lastseen == 0)
			return "Online";
		if(lastseen < 0)
			lastseen = "Never";
		else if(lastseen < 60)
			lastseen = "Few seconds back";
		else if(lastseen < 3600)
			lastseen = parseInt(lastseen/60) + " minutes back";
		else if(lastseen < 3600*24)
			lastseen = parseInt(lastseen/3600) + " hours back";
		else
			lastseen = parseInt(lastseen/(3600*24)) + " days back";

		return "Last seen: " + lastseen;
	}
	
	$scope.getUserStatus = function(user){
		// MesiboLog("getUserName", user);
		if(!user) return "";
		return user.getStatus();
	}
	
	$scope.getMemberType = function(type){
		if(type == 1) return "Group Owner";
		if(type == 2) return "Group Admin";
		return "Member";
	}
	
	$scope.getMemberInfo = function(p){
		return "";
	}

	$scope.getUserLastMessage = function(m){

		var profile = m.profile;

		if(!profile) {
			return "";
		}

		if(profile.isGroup() && profile.isTypingInGroup(m['groupid'])) 
			return "typing...";

		if(m.filetype)
			return getFileTypeDescription(m);

		return this.getMessageText(m);
	}

	$scope.getUserLastMessageTime = function(m){
		if(m.date.daysElapsed) return m.getDateVerbal(true, "Today", "Yesterday");
		return m.getTime();
	}

	$scope.getUserUnreadCount = function(m, index){
		var p = $scope.getProfileFromMessage(m);

		var rs =  p.createReadSession(null);

		rs.getUnreadCount( function on_unread(count){
			//console.log("getUnreadCount from db", "a: "+ user.getAddress(), "g: "+ user.getGroupId(), "c: "+ count);
			if(!count)
				count = "";

			document.getElementById("unread_count_"+ index).innerHTML = count;
		});
	} 

	$scope.getMessageStatusClass = function(m){
		if(!isValid(m))
			return "";

		if($scope.isReceived(m)){
			return "";
		}

		var status = m.status;
		var status_class = getStatusClass(status);
		if(!isValidString(status_class))
			return -1;

		return status_class;
	}

	$scope.getFileName = function(m){
		if(!m)
			return;

		var name = m.getFileName();
		if(name) return name;

		if(m.title)
			return m.title;

		var fileUrl = m.fileurl;
		if(!fileUrl)
			return;

		var f = fileUrl.split("/");
		if(!(f && f.length))
			return;

		var fname = f[f.length - 1];
		return fname;
	}

	$scope.getVideoWidth = function(e){
		MesiboLog("getVideoWidth", e);
	}

	$scope.getVideoHeight = function(e){
		MesiboLog("getVideoHeight", e);
	}

	$scope.setLinkPreview = function(lp){
		$scope.link_preview = lp;
		$scope.refresh();
	}

	$scope.closeLinkPreview = function(){
		$scope.link_preview = null;
		$scope.refresh();
	}

	$scope.inputTextChanged = async function(){
		MesiboLog('inputTextChanged');
		if(isLinkPreview){
		}
	}

	$scope.getUserActivity = function(u) {
		if(!u) return "";
		if(u.getGroupId() > 0) return ""; // This is not correct/complete as we can still show a user typing

		if(u.isTyping()) return "typing...";
		if(u.isChatting()) return "chatting with you...";
		if(u.isOnline()) return "online";
		return "";
	}

	$scope.getLastMessageColor = function(m) {
		var profile = m.profile;
		if(profile && profile.isTypingInGroup(m.groupid)) return "#008800";
		return "#000000";
	}

	$scope.getMessageStatusColor = function(m){
		// MesiboLog("getMessageStatusColor", m);
		if(!isValid(m))
			return "";

		if($scope.isReceived(m))
			return "";
		
		if(m.isDate())
			return "#777777";

		if(m.isCall())
			return "#CC0000";

		var status = m.status;
		var status_color = getStatusColor(status);
		if(!isValidString(status_color))
			return "";

		return status_color;
	}
	
	$scope.getMessageColor = function(m){
		if(m.isDate())
			return "#777777";

		if(m.isCall())
			return "#CC0000";

		return "#000000";
	}
	
	$scope.isOnlineFromMessage = function(m){
		return false;

		var profile = m.profile;
		if(profile) return profile.isOnline();
		return false;
	}

	$scope.deleteTokenInStorage = function(){
		localStorage.removeItem("MESIBO_MESSENGER_TOKEN");
	}
	
	$scope.logout = function(deleteToken){
		if(deleteToken) $scope.deleteTokenInStorage();
		$scope.mesibo.stop();
		window.location.replace("index.html");
	}

	$scope.getFileIcon = function(f){
		return getFileIcon(f);
	}

	$scope.summaryListener = {};
	$scope.summaryListener.Mesibo_onMessage = function(m) {
		if(m && !m.isLastMessage()) 
			return;

		if(isMessageSync && !m && !$scope.users_synced){
			MesiboLog("Run out of users to display. Syncing..");
			$scope.users_synced = true;
			$scope.syncMessages(this, this.readCount - result);
		}

		var msgs = this.getMessages();
		if(msgs && msgs.length > 0){
			var m = msgs[0];
			$scope.generateMessageArea($scope.getProfileFromMessage(m));
		}
				
		$scope.refresh()
	}

	$scope.sessionReadSummary = function(){
		$scope.summarySession = new MesiboReadSession($scope.summaryListener);
		$scope.summarySession.enableSummary(true);
		$scope.summarySession.readCount = MAX_MESSAGES_READ_SUMMARY;
		$scope.summarySession.read(MAX_MESSAGES_READ_SUMMARY);
	}
	
	$scope.getSummary = function() {
		if($scope.summarySession) {
			var m =  $scope.summarySession.getMessages();
			if(m) return m;
		}
		return [];
	}
	
	$scope.getMessages = function() {
		return $scope.messages;
	}

	$scope.syncMessages = function(readSession, count, type){
		if(!(readSession && count && readSession.sync)){
			MesiboLog("syncMessages", "Invalid Input", readSession, count);
			return;
		}

		MesiboLog("syncMessages called \n", readSession, count);	
		$scope.refresh();

		readSession.sync(count,
			function on_sync(i){
				MesiboLog("on_sync", i);
				if(i > 0){
					MesiboLog("Attempting to read "+ i + " messages");
					this.read(i);
				}
			});
	}
	
	$scope.Mesibo_onMessage = async function(m) {
		MesiboLog("$scope.prototype.OnMessage", m);
		if(isMessageSync && !m){
			MesiboLog("Run out of messages to display. Syncing..");
			$scope.msg_read_limit_reached = true;
			$scope.syncMessages(this, this.readCount, 1);
		}
		
		if(!m) {
			$scope.refresh();
			return;
		}

		if(!m.mid || m.presence)
			return;

		if(!m.isDestinedFor($scope.selected_user))
			return;
		
		if(m.isRealtimeMessage()) {
			var prev = null;
			if($scope.messages.length) {
				prev = $scope.messages[$scope.messages.length-1];
			}

			if(m.date == undefined || m.date.daysElapsed == undefined) {
				var dd = m.date;
			}

			if(!prev || (!prev.isDate() && prev.date.daysElapsed != m.date.daysElapsed)) {
				var d = m.cloneDate();
				$scope.messages.push(d);
			}

			$scope.messages.push(m);
		}
		else  {
			var prev = null;
			if($scope.messages.length) {
				prev = $scope.messages[0];
			}
			
			if(m.date == undefined || m.date.daysElapsed == undefined) {
				var dd = m.date;
			}

			if(prev && !prev.isDate() && prev.date.daysElapsed != m.date.daysElapsed) {
				var d = prev.cloneDate();
                                $scope.messages.unshift(d);	
			}  
			
			$scope.messages.unshift(m);

			if(m.isLastMessage()) {
				var d = m.cloneDate();
                                $scope.messages.unshift(d);	
			}
		}

		if(m.isRealtimeMessage() || m.isLastMessage()){
			$scope.refresh();
			$scope.scrollToLastMsg();
		}

		return 0;
	};

	$scope.Mesibo_onPresence = async function(m) {
		// calling refresh is not optimized but keep it for now
		$scope.refresh();
	}

	$scope.sessionReadMessages = function(user, count){
		MesiboLog("sessionReadMessages", user);
		$scope.messages.length = 0;
		$scope.messageSession =  user.createReadSession($scope);
		$scope.messageSession.enableReadReceipt(true);
		$scope.messageSession.readCount = count;
		$scope.messageSession.read(count);
	}

	$scope.readMessages = function(userScrolled){

		if($scope.messageSession)
			$scope.messageSession.read(MAX_MESSAGES_READ);
		else
			$scope.sessionReadMessages($scope.selected_user, MAX_MESSAGES_READ);
	}

	$scope.deleteSelectedMessage = async function(m){
		if(!m) return;

		for(var i=0 ; i < $scope.messages.length; i++) {
			if($scope.messages[i].mid == m.mid) {
				$scope.messages.splice(i, 1);
				break;
			}
		}

		await m.delete();

		if(!$scope.messages.length) {
			var s = $scope.getSummary();
			if(s.length) {
				$scope.generateMessageArea($scope.getProfileFromMessage(s[0]));
			}
		}
		$scope.refresh();
		return;
	}

	$scope.deleteMessages = async function() {
		if(!$scope.selected_user)
			return;

		await $scope.selected_user.deleteMessages();

		var s = $scope.getSummary();
		if(s.length) {
			$scope.generateMessageArea($scope.getProfileFromMessage(s[0]));
		}
		$scope.refresh();
	}

	$scope.forwardMessageTo = function(to){
		MesiboLog("forwardMessageTo", to);
		if(!to)
			return;

		var m = $scope.forward_message;
		MesiboLog(m, $scope.forward_message);
		if(!m)
			return;

		$scope.forwardSelectedMessage(m, to);

		$scope.forward_message = null;
		$scope.refresh();

		$scope.generateMessageArea(to);
	}

	$scope.forwardSelectedMessage = function(m, to){
		MesiboLog("forwardSelectedMessage", m, to);
		if(!m || !to)
			return;

		m = m.forward(to);
		m.send();

		$scope.refresh();
		$scope.scrollToLastMsg();
	}

	$scope.resendSelectedMessage = function(m){
		MesiboLog("resendSelectedMessage", m);
		if(!$scope.selected_user)
			return;

		m.resend();
	}

	$scope.onKeydown = function(event){
		if(event.keyCode === 13) 
			$scope.sendMessage();
		else 
			$scope.selected_user.sendTyping();

		//event.preventDefault();
	}

	//Send text message to peer(selected user) by reading text from input area
	$scope.sendMessage = function() {
		MesiboLog('sendMessage');

		var value = $scope.input_message_text;
		if(!value)	
			return -1;

		var m = $scope.selected_user.newMessage();
		m.message = value;
		m.send();

		$scope.input_message_text = "";
		$scope.refresh();
		$scope.scrollToLastMsg();
		return 0;
	}

	$scope.makeVideoCall = function(){
		$scope.is_video_call = true;
		$scope.call.videoCall();
		$scope.refresh();
	}

	$scope.makeVoiceCall = function(){
		$scope.is_voice_call = true;
		$scope.call.voiceCall();
		$scope.refresh();
	}


	$scope.hideAnswerModal = function(){
		$('#answerModal').modal("hide");
		$scope.is_answer_call = false;
		$scope.refresh();
	}

	$scope.hangupCall = function(){
		$scope.mesibo.hangup(0);
		$scope.hideAnswerModal();
	}


	$scope.answerCall = function(){
		$scope.is_answer_call = true;
		$scope.call.answer();
		$scope.refresh();   
	}

	$scope.showRinging = function(){
		//$('#answerModal').modal({backdrop: 'static', keyboard: false});
		//$('#answerModal').modal({ show: true });
		$('#answerModal').modal("show");
		$scope.refresh();
	}

	$scope.hangupVideoCall = function(){
		$('#videoModal').modal("hide");
		$('#answerModal').modal("hide");
		$scope.is_video_call = false;
		$scope.call.hangup();
		$scope.refresh();
	}

	$scope.hangupAudioCall = function(){
		$('#voiceModal').modal("hide");
		$('#answerModal').modal("hide");
		$scope.is_voice_call = false;
		$scope.call.hangup();
		$scope.refresh();
	}

	$scope.showVideoCall = function(){
		$('#videoModal').modal("show");
		$scope.is_video_call = true;
		$scope.refresh();
	}

	$scope.showVoiceCall = function(){
		$('#voiceModal').modal("show");
		$scope.is_voice_call = true;
		$scope.refresh();
	}

	$scope.clickUploadFile = function(){
		setTimeout(function () {
			angular.element('#upload').trigger('click');
		}, 0);
	}

	$scope.onFileSelect = function(element){
		$scope.$apply(function(scope) {
			var file = element.files[0];
			if(!file){
				MesiboLog("Invalid file");
				return -1;
			}

			if(file.size > MAX_FILE_SIZE_SUPPORTED){
				MesiboLog("Uploaded file larger than supported(10 MB)");
				alert("Please select a file smaller than 10Mb");
				return;
			}

			MesiboLog("Selected File =====>", file);

			$scope.selected_file = file;
			$scope.showFilePreview(file);
			MesiboLog('Reset', element.value);
			element.value = '';

		});
	}

	$scope.showFilePreview = function(f) {
		var reader = new FileReader();
		$('#image-preview').attr('src', "");
		$('#video-preview').attr('src', "");
		$('#video-preview').hide();

		reader.onload = function(e) {
			if(isValidFileType(f.name, 'image')){
				$('#image-preview').attr('src', e.target.result);
				$('#image-preview').show();
			}
			else if(isValidFileType(f.name, 'video')){
				$('#video-preview').attr('src', e.target.result);
				$('#video-preview').show();
			}
		}

		reader.readAsDataURL(f);

		var s = document.getElementById("fileModalLabel");
		if (s) {
			s.innerText = "Selected File " + f.name;
		}

		$('#fileModal').modal("show");
	}

	$scope.openAudioRecorder = function(){
		$('#recorderModal').modal("show");
		document.getElementById("recorderModalLabel").innerHTML = "Audio Recorder";
		$scope.recorder = new MesiboRecorder($scope, "audio");
		$scope.recorder.initAudioRecording();
	}

	$scope.openPictureRecorder = function(){
		$('#recorderModal').modal("show");
		document.getElementById("recorderModalLabel").innerHTML = "Video Recorder";
		$scope.recorder = new MesiboRecorder($scope, "picture");
		$scope.recorder.initPictureRecording();
	}

	$scope.closeRecorder = function(){
		MesiboLog("Closing recorder.., shutting down streams.", $scope.recorder);
		$('#recorderModal').modal("hide");
		if(!$scope.recorder)
			return;
		$scope.recorder.close();
		$scope.recorder = null;			
	}

	$scope.closeFilePreview = function() {
		$('#fileModal').modal("hide");
		$('#image-preview').hide();
		$('#video-preview').hide();
		//Clear selected file button attr
	}

	$scope.selectProfilePicture = function(){
		setTimeout(function () {
			angular.element('#profile-pic-input').trigger('click');
		}, 0);
	}

	$scope.onProfileImageSelect = function(element){
		$scope.$apply(function(scope) {
			var file = element.files[0];
			if(!file){
				MesiboLog("Invalid file");
				return -1;
			}

			if(file.size > MAX_FILE_SIZE_SUPPORTED){
				MesiboLog("Uploaded file larger than supported(10 MB)");
				alert("Please select a file smaller than 10Mb");
				return;
			}

			var c = $scope.mesibo.getSelfProfile();
			c.setImage(file);
			c.save();

			$scope.refresh();

			MesiboLog('Reset', element.value);
			element.value = '';

		});
	}

	$scope.setSelfProfileName = function(u){
		var c = $scope.mesibo.getSelfProfile();
		//c.picture = u.photo;
		c.setName($scope.self_profile_name);
		c.save();

		$scope.refresh();
	}

	$scope.getSelfProfile = function(){
		return $scope.mesibo.getSelfProfile();
	}


	$scope.setProfilePicture = function(){
	}


	$scope.sendFile = function(){
		var m = $scope.selected_user.newMessage();
		m.setContent($scope.selected_file);
		m.message = $scope.input_file_caption;
		m.send();

		$scope.input_file_caption = '';
	}

	$scope.isFileMsg = function(m){
		return isValid(m.filetype);
		//return isValid(m.filetype) || m.fileurl.length > 0;
	}

	$scope.isFailedMessage = function(m){		    
		if(!m || !m.isFailed())
			return false;

		return true;
	}

	//Message contains URL Preview
	$scope.isUrlMsg = function(m){
		return ($scope.isFileMsg(m) && !isValidString(m.fileurl));
	}

	$scope.Mesibo_onConnectionStatus = function(status){
		$scope.isConnected = false;

		MesiboLog("MesiboNotify.prototype.Mesibo_onConnectionStatus: " + status);	
		if(MESIBO_STATUS_SIGNOUT == status || MESIBO_STATUS_AUTHFAIL == status ){
			$scope.logout(MESIBO_STATUS_AUTHFAIL == status);
		}

		var s ="";
		switch(status){
			case MESIBO_STATUS_ONLINE:
				s = "";
				$scope.isConnected = true;
				break;
			case MESIBO_STATUS_CONNECTING:
				s = "Connecting..";
				break;
			default: 
				s = "Not Connected";
		}

		$scope.connection_status = s;
		$scope.refresh();
	}

	$scope.Mesibo_onProfileUpdated = function(p){
		$scope.refresh();
	}

	$scope.updateReadPrevious = function(index){
		MesiboLog("updateReadPrevious");
		for (var i = index; i >= 0; i--) {
			if($scope.messages[i].status == MESIBO_MSGSTATUS_READ)
				return;

			if($scope.messages[i].status == MESIBO_MSGSTATUS_DELIVERED)
				$scope.messages[i].status = MESIBO_MSGSTATUS_READ;
		}
	}

	$scope.Mesibo_onMessageStatus = function(m){
		MesiboLog("$scope.Mesibo_onMessageStatus", m);

		//In case of shared popup, need to manually update message across all tabs
		for (var i = $scope.messages.length - 1; i >= 0 && $scope.is_shared; i--) {
			if($scope.messages[i].mid == m.mid){
				$scope.messages[i].status = m.status;

				if(m.status == MESIBO_MSGSTATUS_READ && i
					&& $scope.messages[i-1].status
					!= MESIBO_MSGSTATUS_READ){ //Make all previous delivered msgs to read
					$scope.updateReadPrevious(i - 1);
				}

				break;
			}
		}
		$scope.refresh();
	}


	$scope.Mesibo_onCall = function(callid, from, video){
		if(video){
			$scope.is_video_call = true;
			$scope.mesibo.setupVideoCall("localVideo", "remoteVideo", true);
		}
		else{
			$scope.is_voice_call = true;
			$scope.mesibo.setupVoiceCall("audioPlayer");
		}

		$scope.call_alert_message = "Incoming "+(video ? "Video" : "Voice")+" call from: "+from;
		$scope.is_answer_call = true;

		$scope.showRinging();
	}

	$scope.Mesibo_onCallStatus = function(callid, status){

		var s = "";

		switch (status) {
			case MESIBO_CALLSTATUS_RINGING:
				s = "Ringing";
				break;

			case MESIBO_CALLSTATUS_ANSWER:
				s = "Answered";
				break;

			case MESIBO_CALLSTATUS_BUSY:
				s = "Busy";
				break;

			case MESIBO_CALLSTATUS_NOANSWER:
				s = "No Answer";
				break;

			case MESIBO_CALLSTATUS_INVALIDDEST:
				s = "Invalid Destination";
				break;

			case MESIBO_CALLSTATUS_UNREACHABLE:
				s = "Unreachable";
				break;

			case MESIBO_CALLSTATUS_OFFLINE:
				s = "Offline";
				break;      

			case MESIBO_CALLSTATUS_COMPLETE:
				s = "Complete";
				break;      
		}

		if(s)
			$scope.call_status = "Call Status: " + s;
		$scope.refresh();

		if (status & MESIBO_CALLSTATUS_COMPLETE) {
			if ($scope.is_video_call)
				$scope.hangupVideoCall();
			else
				$scope.hangupAudioCall();
		}
	}

	$scope.init_messenger = function(){
		MesiboLog("init_messenger called"); 
		$scope.sessionReadSummary();     
		$scope.call = new MesiboCall($scope);
		$scope.file = new MessengerFile($scope);
	}

	$scope.init_popup = function(){ 
		MesiboLog("init_popup called"); 
		$scope.selected_user = $scope.mesibo.getProfile(POPUP_DESTINATION_USER, 0); 
		$scope.activity = ""; 

		$scope.call = new MesiboCall($scope);
		$scope.file = new MessengerFile($scope);

		$scope.MAX_MEDIA_WIDTH = '180px';
		$scope.MAX_MEDIA_HEIGHT = '80px';

		$scope.MIN_MEDIA_WIDTH = '50px';
		$scope.MIN_MEDIA_HEIGHT = '50px';

		MesiboLog("sessionReadMessages", $scope.selected_user, MAX_MESSAGES_READ);
		$scope.sessionReadMessages($scope.selected_user, MAX_MESSAGES_READ); 
	} 

	$scope.toggleConnection = function(){
		if($scope.isConnected){
			MesiboLog("Stop Mesibo..");
			$scope.mesibo.stop();
		}
		else{
			MesiboLog("Start Mesibo..");
			$scope.mesibo.start();
		}
	}

	$scope.getToken = function() {
		if(null == $scope.mesibo)
			$scope.mesibo = Mesibo.getInstance();
		getMesiboDemoAppToken($scope.mesibo);
	}

	$scope.initMesibo = function(demo_app_name){

		if(demo_app_name == "multitab-popup"){
			// Instead of directly accessing Mesibo APIs like so,
			// $scope.mesibo = new Mesibo();
			// use a wrapper API that uses a shared worker 
			$scope.mesibo = new MesiboWorker($scope);
		}

		$scope.mesiboNotify = $scope;

		//Initialize Mesibo
		if(!MESIBO_APP_ID || !getLoginToken()){
			alert("Invalid token or app-id. Check config.js");
			return;
		}

		$scope.isLoggedIn = true;
		$scope.mesibo = Mesibo.getInstance();
		$scope.mesibo.setAppName(MESIBO_APP_ID);
		$scope.mesibo.setCredentials(getLoginToken());
		$scope.mesibo.setListener($scope.mesiboNotify);
		$scope.mesibo.setDatabase("mesibodb", function(init){
			MesiboLog("setDatabase", init);

			if(!init){
				ErrorLog("setDatabase failed");
				return;
			}

			//Database initialized successfully

			//Initialize Application
			if(demo_app_name == "messenger"){
				$scope.init_messenger();
			}

			if(demo_app_name == "popup"){
				//Contact synchronization is not required for popup
				$scope.is_shared = false;
				$scope.init_popup();
			}

		});

		$scope.mesibo.start();   

		if(demo_app_name == "shared-popup"){
			//Contact synchronization is not required for shared-popup
			$scope.is_shared = true;
			$scope.init_popup();
		}

		$scope.refresh();
	}

	onControllerReady();
	console.log("AppController loading done");
}]);


