# IGM-Vis: Analyzing Intergalactic and Circumgalactic Medium Absorption Using Quasar Sightlines in a Cosmic Web Context

[![IGM-Vis](images/IGM-Vis_overview.png)](images/IGM-Vis_overview.png "IGM-Vis")


The Intergalactic Media Visualization, or IGM-Vis, is a novel visualization and data analysis platform for investigating galaxies and the gas that surrounds them in context with their larger scale environment, the Cosmic Web.  Environment is an important factor in the evolution of galaxies from actively forming stars to a quiescent state with little, if any, discernible star formation activity. The gaseous halos of galaxies (the circumgalactic medium, or CGM) play a critical role in their evolution, because the gas necessary to fuel star formation and any gas expelled from widely observed galactic winds must encounter this interface region between galaxies and the intergalactic medium (IGM). 


The blue and red spheres represent star-forming and quiescent galaxies, respectively, and the
'skewers' piercing the volume are QSO sightlines. Mouse over a galaxy to see an image and a few
of its properties in the lower panel.  Mouse over a skewer and the right-hand panels show the spectral region where H I or C IV (or other available sperctra) fall within a specified redshift range.  If a galaxy has an impact parameter within the range indicated by the bottom-right slider, a
vertical line will appear at its redshift in the spectral window.  Use the two drop-down boxes to
control the height and thickness of these lines according to different properties.  Lastly, control
the range of redshift shown in the spectral windows with the sizing bar between the drop-downs and
the slider.

Galaxy/absorber pairs can be tracked using the numeric keys '0' through '9' (skghtlines) and 'G' (galaxies), and then saved to disk for further analysis by pressing 'D'. 

#Video Documentation

A video tutorial with an example use case can be seen here [https://www.youtube.com/watch?v=3ZVaExEVZOk](https://www.youtube.com/watch?v=3ZVaExEVZOk)

[![IGM-Vis](images/IGM-video.jpg)](https://www.youtube.com/watch?v=3ZVaExEVZOk "IGM-Vis")

#Web Demo

The Web demo of IGM-Vis is located at: [https://creativecodinglab.github.io/Intergalactic/intergalactic.html](https://creativecodinglab.github.io/Intergalactic/intergalactic.html) 




## Keystrokes Quick Reference<br/>
arrow keys: move reference point<br/>
0 - 9 : store selected skewer<br/>
E : obtain equivalent width measurements<br/>
G : store selected galaxy<br/>
D : download json file of all stored skewers with galaxy neighbor pairs<br/>
S : show / hide skewers in 3D view  <br/>
T : show / hide text in 3D view  <br/>
Z : zoom camera to selected galaxy <br/>
