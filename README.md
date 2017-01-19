Instant Image Cloning
=======
Yijie

## Demo

- Use a static server to host the files to overcome the cross-origin restriction.
- Open the demo web page, select a region on the source (upper) image, then drag the cloned region on the target image.
- There are four moded for comparing:

  1. Composite: simply copy the source image pixel by pixel;
  2. Average: take the average pixel value of the two images (equivalent to alpha = 50%);
  3. Mean-value Coordinates: approximate the solution of Poisson equation by calculating the MVC;
  4. Memberane: just the difference imposed on the source image to obtain the MVC result (i.e., the difference of MVC mode and Composite mode).


## Files

- ui.js: read/write canvas image data, mouse controls;
- mvc.js: calculate hierarchical boundary, mean-value coordinates;
- quad.js: construct quadratree, conjugate gradient descent(bug still not fixed);
- cloner.js: get the boundary difference, produce image data to put on source/target canvas subject to the boundary conditions;

+ [lib]cdt.js: for Constrained Delaunay Triangulation, a few Node.js library;
+ [lib]underscore-min.js [lib]: some commonly used Js utils.



## Reference

1. Coordinates for Instant Image Cloning
2. Efficient Gradient-Domain Compositing Using Quadtrees
