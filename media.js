function mPlay(ID){
	document.getElementById(ID).play();
	document.getElementById(ID).currentTime = 0;
}

function mStop(ID){
document.getElementById(ID).pause();
document.getElementById(ID).currentTime = 0;

}

function mPause(ID){
document.getElementById(ID).pause();
}