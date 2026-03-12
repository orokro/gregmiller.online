<?
	$preSet=false;
	$imgA='';
	$imgB='';
	$imgC='';
	$comicLink='';
	if(isset($_GET['cid']) && $_GET['cid']!=''){
		
		$frames = explode('-',$_GET['cid']);
		
		$imgA = ('src="' . "MIXED/A_" . $frames[0] . "_" . $frames[1] . ".png" . '"');
		$imgB = ('src="' . "MIXED/B_" . $frames[0] . "_" . $frames[2] . ".png" . '"');
		$imgC = ('src="' . "MIXED/C_" . $frames[0] . "_" . $frames[3] . ".png" . '"');
		
		$comicLink = 'http://www.jumblebag.com/gf/?cid=' . $frames[0].'-'.$frames[1].'-'.$frames[2].'-'.$frames[3];
		$preSet=true;
	}
		
?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
    <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title>Random Comic Generator!</title>
    <style type="text/css">
	
		/* pretty frame */
		#divContent {
			width:760px;
			padding:15px 10px 30px 10px;
			border:#09F 1px solid;
			background:#ECF4FF;
			margin-left:auto;
			margin-right:auto;
		}
		
		/* actual comic */
		#divComic {
			background:#FFF;
			border:#CCC 1px solid;
			padding:5px;	
			position:relative;
			width:723px;
			height:236px;
			margin-left:auto;
			margin-right:auto;
			margin-top:10px;
		}
		
		/* comic frames */
		#imgA { position:absolute; left:5px; }
		#imgB { position:absolute; left:246px; }
		#imgC { position:absolute; left:487px; }
		.comicFrame {
			width: 236px;
			height: 236px;
			top:5px;
		}
		
		/* generate button */
		#divButton {
			padding:15px;	
		}
	</style>
</head>

<body>
	<div id="divWrapper" align="center">
    	<div id="divContent">
        	Randomly Generated Comic!
        	<div id="divComic">
            	<img id="imgA" class="comicFrame" <?=$imgA?> width="236" height="236" />
                <img id="imgB" class="comicFrame" <?=$imgB?> width="236" height="236" />
                <img id="imgC" class="comicFrame" <?=$imgC?> width="236" height="236" />
            </div><!-- /divComic -->
            <div id="divLink">
            	Link this comic!<br />
                <input id="txtLink" name="txtLink" type="text" size="50" value="<?=$comicLink?>" />
            </div><!-- /divLink -->
            <div id="divButton" align="center">
            	<button type="button" onclick="generate_comic();">Generate New</button>
            </div><!-- /divButton -->
        </div><!-- /divContent -->
    </div><!-- /divWrapper -->
    
    <script type="text/javascript">
		var Limits = new Array();
		Limits['G']=52;
		Limits['L']=5;
		Limits['TV']=7;
		Limits['TV']=7;
			
		var onTopic=false;
		
		//create a comic:
		function generate_comic(){
			onTopic=false;
			
			//var imgA = document.getElementById('imgA');
			//var imgB = document.getElementById('imgB');
			//var imgC = document.getElementById('imgC');
			
			var topic = chooseTopic();
			
			var frameA = randomInt(1,Limits[topic]);
			var frameB = randomInt(1,Limits[topic]);
			var frameC = randomInt(1,Limits[topic]);
			
			imgA.src = ("http://www.gmiller.net/misc/Garfield/MIXED/A_" + topic + "_" + frameA + ".png");
			imgB.src = ("http://www.gmiller.net/misc/Garfield/MIXED/B_" + topic + "_" + frameB + ".png");
			imgC.src = ("http://www.gmiller.net/misc/Garfield/MIXED/C_" + topic + "_" + frameC + ".png");
			
			var txtLink = document.getElementById('txtLink');
			txtLink.value = ('http://www.gmiller.net/misc/Garfield/?cid=' + topic + '-' + frameA + '-' + frameB + '-' + frameC);
			
		}//generate_comic()
		
		//choose topic:
		function chooseTopic(){
			switch(randomInt(1,2)){
				case 1: //generic
					return 'G';
				case 2: //liz
					return 'O';
				case 3: //odie
					return 'O';
				case 4: //TV
					return 'TV';
			}//swatch
		}//chooseTopic()
		
		//set random frame
		function setFrame(Num, Topic){
			var imgA = document.getElementById('imgA');
			var imgB = document.getElementById('imgB');
			var imgC = document.getElementById('imgC');
			
			switch(Num){
				case 1: //first frame
				
				
				
			}//swatch
			
			
		}//setFrame(Num, Topic)
		
		//generate random frame number
		function randomInt(Min, Max){
			var i=0;
			var n=0;
			for(i=0; i<(Math.floor(Math.random()*(80))+1); i++){
				n= (Math.floor(Math.random()*(Max-Min))+Min);
			}//next i
			return n;
		}//randomFrame();
		
		<? if(!$preSet):?>
		//on load, make first comic:
		generate_comic();
		<? endif; ?>
		
	</script>
</body>
</html>
