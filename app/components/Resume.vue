<!--
	Resume.vue
	----------

	This will be a component that just displays my resume.

	NOTE: the CSS and markup for this page is ported from my old ~2010 site,
	so it was just componentized and styled to fit the new design.

-->
<script setup>

// vue
import { onBeforeUnmount, onMounted, ref } from 'vue';

// ---------------------------------------------------------------------------
// Responsive scaling
// ---------------------------------------------------------------------------
// Layout is authored in em units. We scale by changing the root font-size on
// .resumeScaleWrapper so normal document flow/height is preserved (no transform).

const BASE_WIDTH_PX = 830;
const BASE_FONT_PX = 9.6;

const mainResumeWrapperEl = ref(null);
const resumeRootFontPx = ref(BASE_FONT_PX);

let resizeObserver;

const updateResumeScale = () => {
	const el = mainResumeWrapperEl.value;
	if (!el) {
		return;
	}

	// clientWidth is stable and avoids fractional scrollbar weirdness.
	const wrapperWidth = el.clientWidth;
	if (!wrapperWidth) {
		return;
	}

	resumeRootFontPx.value = BASE_FONT_PX * (wrapperWidth / BASE_WIDTH_PX);
};

onMounted(() => {
	updateResumeScale();

	if (typeof ResizeObserver !== 'undefined') {
		resizeObserver = new ResizeObserver(() => {
			updateResumeScale();
		});
		resizeObserver.observe(mainResumeWrapperEl.value);
	}
	else {
		window.addEventListener('resize', updateResumeScale, { passive: true });
	}
});

onBeforeUnmount(() => {
	if (resizeObserver) {
		resizeObserver.disconnect();
		resizeObserver = undefined;
	}
	window.removeEventListener('resize', updateResumeScale);
});

</script>
<template>

	<div class="mainResumeWrapper" ref="mainResumeWrapperEl">

		<!-- wrapper used for scaling -->
		<span
			class="resumeScaleWrapper"
			:style="{ fontSize: resumeRootFontPx + 'px' }"
		>

			<!-- main resume border container -->
			<div class="resumeContainer">

				<!-- header area for resume -->
				<div class="resumeHeader" align="center">

					<!-- my name -->
					<div class="myName darkGrayFont boldFont">GREG MILLER</div>

					<!-- my title -->
					<div class="myTitle mediumGrayFont">SOFTWARE ENGINEER / 3D MODELER</div>

					<!-- small separator line -->
					<div class="headerSeparatorLine"></div><br>

					<!-- bio list wrapper -->
					<div class="resumeBioWrapper mediumGrayFont">

						<!-- bio list -->
						<ul>
							<li>Been developing and 3D modeling for fun and professionally for 26 years</li>
							<li>My work has been featured on Fox News, Time Magazine, IGN, Gamespot, The Verge and more!
							</li>
							<li>International coverage for my (3D) Virtual Reality project,
								<strong>jerrysplacevr.com</strong></li>
							<li>Was the cover story on the East Bay Express</li>
							<li>Once got to shake Steve Wozniak's hand!</li>
						</ul>

						<!-- /.resumeBioWrapper -->
					</div>

					<!-- /.resumeHeader -->
				</div>

				<!-- left vertical column for experience and education sections -->
				<div class="resumeLeftColumn resumeColumn">

					<!-- experience area -->
					<div class="resumeAreaHeader darkGrayFont boldFont">EXPERIENCE</div>

					<div class="resumeLeftColumnItem">
						<div class="topRow">
							<div class="dateRange lightGrayFont" align="right">2023-2025</div>
							<div class="plus lightGrayFont">+</div>
							<div class="company darkGrayFont">Nike <small><small>(via Insight Global)</small></small></div>
						</div>
						<div class="secondRow">
							<div class="jobTitle lightGrayFont">3D-Pipline Software Developer</div>
							<div class="jobDesc mediumGrayFont">
								Developing custom in house 3D software using tools like Blender,<br/>
								Electron, ThreeJS, Vue3, NodeJS, Substance Painter, and others.
							</div>
						</div>
					</div>

					<div class="resumeLeftColumnItem">
						<div class="topRow">
							<div class="dateRange lightGrayFont" align="right">2020-2022</div>
							<div class="plus lightGrayFont">+</div>
							<div class="company darkGrayFont">AT&amp;T <small><small>(via B360)</small></small></div>
						</div>
						<div class="secondRow">
							<div class="jobTitle lightGrayFont">Software Engineer</div>
							<div class="jobDesc mediumGrayFont">
								2D/3D Unity3D engine development, making cyber security<br>
								education games. Also includes 3D modeling and Texture making.
							</div>
						</div>
					</div>

					<div class="resumeLeftColumnItem">
						<div class="topRow">
							<div class="dateRange lightGrayFont" align="right">2019-2020</div>
							<div class="plus lightGrayFont">+</div>
							<div class="company darkGrayFont">Unified Field</div>
						</div>
						<div class="secondRow">
							<div class="jobTitle lightGrayFont">Unity / Full Stack Developer</div>
							<div class="jobDesc mediumGrayFont">
								2D/3D Unity3D engine development making games for museum<br>
								kiosks, including 3d animation of characters. Also museum kiosks<br>
								with web based technologies.
							</div>
						</div>
					</div>

					<div class="resumeLeftColumnItem">
						<div class="topRow">
							<div class="dateRange lightGrayFont" align="right">2015 - 2019</div>
							<div class="plus lightGrayFont">+</div>
							<div class="company darkGrayFont">YouVisit</div>
						</div>
						<div class="secondRow">
							<div class="jobTitle lightGrayFont">Unity / Full Stack Developer - Research &amp; Development
							</div>
							<div class="jobDesc mediumGrayFont">
								2D/3D Unity3D engine development, fixing bugs and<br>
								implementing features for the YouVisit website and platform.<br>
								Working with C#, PHP, MySQL, Javascript, SASS, CSS, and HTML.
							</div>
						</div>
					</div>

					<div class="resumeLeftColumnItem">
						<div class="topRow">
							<div class="dateRange lightGrayFont" align="right">2014 - 2015</div>
							<div class="plus lightGrayFont">+</div>
							<div class="company darkGrayFont">Google <small><small>(via Adecco)</small></small></div>
						</div>
						<div class="secondRow">
							<div class="jobTitle lightGrayFont">3D Modeler / Image Editor</div>
							<div class="jobDesc mediumGrayFont">
								Photoreal product 3D modeling using Maya, and Blender.<br>
								3D scan touch-ups using Zbrush and Blender.<br>
								Product photo editing and blemish removal in Photoshop.
							</div>
						</div>
					</div>

					<!-- <div class="resumeLeftColumnItem">
						<div class="topRow">
							<div class="dateRange lightGrayFont" align="right">2012 - 2014</div>
							<div class="plus lightGrayFont">+</div>
							<div class="company darkGrayFont">Hurricane Electric</div>
						</div>
						<div class="secondRow">
							<div class="jobTitle lightGrayFont">Server Maintenance / Customer Support</div>
							<div class="jobDesc mediumGrayFont">
								Web development, graphic design, engineering tools for<br>
								internal use, server maintenance, cable runs, and customer support.
							</div>
						</div>
					</div> -->

					<!--
					<div class="resumeLeftColumnItem">
						<div class="topRow">
							<div class="dateRange lightGrayFont" align="right">2009 - 2010</div>
							<div class="plus lightGrayFont">+</div>
							<div class="company darkGrayFont">Cisco Systems</div>
						</div>
						<div class="secondRow">
							<div class="jobTitle lightGrayFont">Developer Intern</div>
							<div class="jobDesc mediumGrayFont">
								Web development, graphic design, engineering tools for internal<br>
								use. Video production for web / mobile for training field engineers.
							</div>
						</div>
					</div>
					-->

					<!-- spacer between end of experience area and beginning of education area -->
					<div class="itemSpacer"></div>

					<!-- education area -->
					<div class="resumeAreaHeader darkGrayFont boldFont">EDUCATION</div>

					<div class="resumeLeftColumnItem">
						<div class="topRow">
							<div class="dateRange lightGrayFont" align="right">2004 - 2009</div>
							<div class="plus lightGrayFont">+</div>
							<div class="company darkGrayFont">San Jos&eacute; State University</div>
						</div>
						<div class="secondRow">
							<div class="jobTitle lightGrayFont">Course of study: Computer Science / Digital Media Art</div>
						</div>
					</div>

					<div class="resumeLeftColumnItem">
						<div class="topRow">
							<div class="dateRange lightGrayFont">2012</div>
							<div class="plus lightGrayFont">+</div>
							<div class="company darkGrayFont">Certifications</div>
						</div>
						<div class="secondRow">
							<div class="jobTitle lightGrayFont">W3 Web Certifications</div>
							<div class="jobDesc mediumGrayFont">HTML,&nbsp; JavaScript,&nbsp; CSS,&nbsp; PHP,&nbsp;
								jQuery,&nbsp; XML,&nbsp; ASP</div>
						</div>
					</div>

					<br><br>

					<!-- /.resumeLeftColumn -->
				</div>

				<!-- right vertical column for contact info, portfolio, and expertise sections -->
				<div class="resumeRightColumn resumeColumn">

					<!-- contact area -->
					<div class="resumeAreaHeader darkGrayFont boldFont">CONTACT</div>

					<div class="resumeSmallAreaHeader darkGrayFont boldFont">PHONE</div>
					<div class="resumeSmallItemText mediumGrayFont">4ዐ𝟪 𝟪ᒿ੧-ዐl𝟪б</div>

					<div class="resumeSmallAreaHeader darkGrayFont boldFont">EMAIL</div>
					<div class="resumeSmallItemText mediumGrayFont"><a
							href="mailto:gmills4reals@gmail.com">gmills4reals@gmail.com</a></div>

					<div class="resumeSmallAreaHeader darkGrayFont boldFont">ADDRESS</div>
					<div class="resumeSmallItemText mediumGrayFont">Queens, NY, USA<br>(Contact for details)</div>

					<!-- spacer between areas -->
					<div class="itemSpacer"></div>

					<!-- portfolio area -->
					<div class="resumeAreaHeader darkGrayFont boldFont">PORTFOLIO</div>
					<div class="resumeSmallItemText mediumGrayFont portfolioLink">www.gregmiller.online</div>

					<!-- spacer between areas -->
					<div class="itemSpacer"></div>

					<!-- expertise area -->
					<div class="resumeAreaHeader darkGrayFont boldFont">EXPERTISE</div>

					<div class="resumeSmallAreaHeader mediumGrayFont">ENGINEERING</div>
					<div class="resumeSmallItemText mediumGrayFont spacing">
						NodeJS, Vue, React, R3F,
						Electron, C#, Unity, CSS,
						HTML, JavaScript, Sass,
						ThreeJS, Python, PHP,
						MySQL, MongoDB JSON,
						Apache, Arduino, C++, Java
					</div>

					<!-- spacer between areas -->
					<div class="itemSpacer2"></div>

					<div class="resumeSmallAreaHeader mediumGrayFont">3D / 2D MEDIA</div>
					<div class="resumeSmallItemText mediumGrayFont spacing">
						Blender, Photoshop, Illustrator,
						Davinci Resolve, Procreate,
						MAYA, ZBrush, Aseprite,
						Premiere, After Effects</div>

				<!-- /.resumeRightColumn -->
				</div>

			<!-- /.resumeContainer -->
			</div>

		<!-- /.resumeScaleWrapper -->
		</span>

	<!-- /.mainResumeWrapper -->
	</div>

</template>
<style lang="scss" scoped>

// the main resume wrapper box and it's details
.mainResumeWrapper {

	// MUST NEVER overflow <Container3D/>. Hard stop.
	width: 100%;
	max-width: 100%;
	min-width: 0;
	box-sizing: border-box;
	overflow: hidden;

	// keep it centered inside whatever width it gets
	display: flex;
	justify-content: center;
	align-items: flex-start;

	// used for scaling all em children later
	.resumeScaleWrapper {

		display: block;
		max-width: 100%;

		// fallback (normally overridden by inline :style above)
		font-size: 9.6px;

		// misc font colors and styles
		.darkGrayFont {
			color: #3A3A3C;
		}

		.mediumGrayFont {
			color: #444;
		}

		.lightGrayFont {
			color: #626262;
		}

		.boldFont {
			font-family: 'Montserrat-bold', sans-serif !important;
			font-weight: bold;
		}

		.spacing {
			margin-top: 0.3em;
			letter-spacing: 0.1em;
			line-height: 2em;
		}

		// style for spacer divs between areas
		.itemSpacer {

			// no height, just margin
			height: 0px;
			margin-bottom: 4.8em;
		}

		.itemSpacer2 {
			// no height, just margin
			height: 0px;
			margin-bottom: 2.8em;
		}

		// set up main global settings for resume container
		.resumeContainer {

			// use custom font
			font-family: 'Montserrat', sans-serif;

			// set fixed dimensions using em for scaling
			width: 85em;
			height: 114em;

			// so we can center
			display: inline-block;

			// though this shouldn't matter, hide anything that is outside
			overflow: hidden;

			// use relative positioning so we can position children absolutely
			position: relative;
			margin-bottom: 17px;

			// border and slight bg for now
			// border: 1px solid #CCC;
			background: #FFF;
			border-radius: 3px !important;

			// styles for resume header area
			.resumeHeader {

				// set fixed position and size for ease of layout
				position: absolute;
				left: 0px;
				right: 0px;
				top: 0px;
				width: 100%;
				height: 30em;

				// off white bg color
				background: #F9FAFB;

				// styles for my name at the top of the header
				.myName {

					// since the header container has no padding/margin etc, set here
					margin: 1.2em 0em 0.5em 0em;

					// font settings
					font-size: 3em;
					letter-spacing: 0.2em;

				}// .myName

				// styles for my title in the header area
				.myTitle {

					// font settings
					font-size: 1.4em;
					letter-spacing: 0.1em;

					// just add some margin on the bottom
					margin-bottom: 1.2em;

				}// .myTitle

				// styles for smol horizontal line separate in the header area
				.headerSeparatorLine {

					// set fixed position and size using em for scaling
					display: inline-block;
					width: 3.4em;
					height: 0.2em;

					// simply dark gray bg color
					background: #A7A9AC;

					// just add some margin on the bottom
					margin-bottom: 1.2em;

				}// .headerSeparatorLine

				// styles for container around the list of bio items
				.resumeBioWrapper {

					// display as inline block for centering
					display: inline-block;

					// align to the left, to the left
					text-align: left;

				}// .resumeBioWrapper

				// styles for unsorted list and general list items
				ul, li {
					margin: 0px;
					padding: 0px;
				} // ul, li

				// styles for just the list items
				li {

					// font settings
					font-size: 1.3em;
					line-height: 1.85em;

				}// li

			}// .resumeHeader

			// general styles for the vertical columns on the lower half
			.resumeColumn {

				// always absolutely positioned with some constant values
				position: absolute;
				top: 35em;
				// bottom: 0px;

				// font settings
				text-align: left;

				// header text for items in the columns
				.resumeAreaHeader {

					// font settings
					font-size: 2.0em;
					letter-spacing: 0.10em;

					// guaranteed margin on the bottom
					margin-bottom: 1.4em;

				}// .resumeAreaHeader

				// small header text for items in the columns
				.resumeSmallAreaHeader {

					// font settings
					font-size: 1.3em;
					font-family: 'Montserrat-bold', sans-serif !important;
					font-weight: bold;
					letter-spacing: 0.05em;

				}// .resumeSmallAreaHeader

				// small item text for items in the columns
				.resumeSmallItemText {

					// guaranteed margin on the bottom
					margin-bottom: 1em;

					// font settings
					font-size: 1.3em;

				}// .resumeSmallItemText

				// styles for the left column containing the experience and education sections
				&.resumeLeftColumn {

					// fixed on the left with constant width, with logical sizing
					left: 0px;
					width: 55em;
					box-sizing: border-box;

					// content padding
					padding: 0em 0em 0em 5em;

					// this column will use it's right border as a vertical separator
					border-right: 0.2em solid #A7A9AC;

					// style for main left-column list item
					.resumeLeftColumnItem {

						// adjust for padding
						position: relative;
						top: -1.1em;

						// guaranteed margin on the bottom
						margin-bottom: 1.8em;

						.topRow {

							// fixed height
							height: 3.0em;

							// date range
							.dateRange {

								// display as a fixed size inline block
								display: inline-block;
								width: 6em;

								// move up a bit
								position: relative;
								top: -0.2em;

								// font settings
								font-size: 1.1em;
								text-align: right;

								// fixed height
								height: 1.2em;

								overflow: visible;
								white-space: nowrap;

							}// .dateRange

							.plus {

								// display as a fixed size inline block
								display: inline-block;
								width: 1em;

								// move down a bit
								position: relative;
								top: 0.1em;

								// bigger font, centered
								font-size: 2.4em;
								text-align: center;

								// fixed height
								height: 1.2em;

							}// .plus

							// style for company name
							.company {

								// display as inline block, but any width goes
								display: inline-block;

								// bigger font
								font-size: 1.6em;
								font-weight: bold;

								// fixed height
								height: 1.2em;

							}// .company

						}// .topRow

						// style for the second (main) row in a left-column list item
						.secondRow {

							// add margin to indent to match top row
							margin-left: 8.95em;

							// style for job title line
							.jobTitle {

								// font settings
								font-size: 1em;
								font-family: 'Montserrat-bold', sans-serif !important;
								font-weight: bold;
								color: #999;
								letter-spacing: 0.025em;

								// add padding for spacing
								padding: 0.1em 0em 0.6em 0em;

							}// .jobTitle

							// style for job description area
							.jobDesc {

								// font settings
								font-size: 1.1em;

							}// .jobDesc

						}// .secondRow

					}// .resumeLeftColumnItem

				}// &.resumeLeftColumn

				// style for right column
				&.resumeRightColumn {

					// fixed size and position on the right
					right: 0px;
					width: 30em;
					box-sizing: border-box;

					// content padding
					padding: 0em 4em 0em 4em;

					// special positioning for portfolio link
					.portfolioLink {

						// move up a bit since spacing is awkward
						position: relative;
						top: -0.8em;
					}// .portfolioLink

					// dev/art icons in right column
					.iconsImage {

						// fixed width for scaling
						width: 17em;

						// give a bit of space on top
						margin: 0.2em 0em;

					}// .iconsImage

				}// &.resumeRightColumn

			}// .resumeColumn

		}// .resumeContainer

	}// .resumeScaleWrapper

}// .mainResumeWrapper

</style>
