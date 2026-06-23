# Caretta Caretta Field Vectors

Loggerhead sea turtle (*Caretta caretta*) magnetosensation can be modeled as a
vector-to-features pipeline. The animal probably does not sense Cartesian field
components the way an instrument would, but its behavior is consistent with
extracting direction and location cues from the geomagnetic field vector.

```text
B = [Bx, By, Bz]
F = |B|                         // total intensity
H = sqrt(Bx^2 + By^2)            // horizontal component
I = atan2(Bz, H)                 // inclination angle
A = atan2(By, Bx)                // horizontal magnetic bearing
```

The sensory interpretation can be split into two channels.

1. Compass channel

   The turtle uses directional structure in `B`, especially the field axis and
   inclination, to select a swimming bearing. Hatchling loggerheads orient in
   darkness using Earth-strength magnetic fields, and reversing the horizontal
   component changes their orientation. That implies the magnetic vector can
   drive heading choice.

2. Map channel

   The turtle also appears to derive location-like information from `F` and
   `I`: total field intensity and inclination. Together these form a rough
   two-coordinate magnetic signature for a geographic region. A useful
   computational abstraction is:

   ```text
   sensory_signature = [F, I]
   error = sensory_signature - target_signature
   desired_swim_vector = policy(error, current_heading, inherited_or_learned_route)
   ```

In this model, a field like `[north, east, down]` is reduced into "where am I?"
cues (`F`, `I`) plus "which way am I facing relative to the field?" cues
(`A`, field-axis inclination). Those features are compared against inherited or
learned magnetic signatures to produce a swimming vector.

Recent work suggests the map and compass channels may rely on distinct
mechanisms. Radio-frequency fields disrupted compass orientation but not learned
map responses, while magnetic pulses disrupted map responses. That pattern is
consistent with separate sensory machinery for map and compass processing,
though the exact receptors are not fully settled.

## Symbol Types

The symbolic entities in the vector conversion can be classified as generic
mathematical and programmatic types.

| Symbol | Type | Meaning |
| --- | --- | --- |
| `B` | 3D vector / array | Total magnetic field in 3D space. |
| `Bx` | Scalar, linear component | X-axis component. |
| `By` | Scalar, linear component | Y-axis component. |
| `Bz` | Scalar, linear component | Z-axis component. |
| `F` | Scalar, magnitude | Total vector magnitude or Euclidean norm. |
| `H` | Scalar, magnitude | Two-dimensional projected magnitude on the horizontal plane. |
| `I` | Scalar, angle | Elevation or inclination angle. |
| `A` | Scalar, angle | Azimuth or horizontal bearing angle. |

The operations in the conversion can also be typed.

| Symbol | Type | Meaning |
| --- | --- | --- |
| `[ ]` | Data structure constructor | Creates the array or vector. |
| `| |` | Norm / magnitude operator | Calculates the Euclidean length of a vector. |
| `sqrt()` | Unary function | Calculates the square root of a single value. |
| `^` | Binary operator | Exponentiation or power. |
| `atan2()` | Binary function | Calculates the two-argument arctangent and resolves the correct quadrant. |

Follow-up: [Caretta Caretta Information Primitives](./caretta-caretta-information-primitives.md)

References:

- Kenneth J. Lohmann, "Magnetic Orientation By Hatchling Loggerhead Sea Turtles
  (Caretta caretta)," Journal of Experimental Biology, 1991:
  https://journals.biologists.com/jeb/article/155/1/37/6396/Magnetic-Orientation-By-Hatchling-Loggerhead-Sea
- Kenneth J. Lohmann, Nathan F. Putman, and Catherine M. F. Lohmann, "The
  magnetic map of hatchling loggerhead sea turtles," Current Opinion in
  Neurobiology, 2012: https://pubmed.ncbi.nlm.nih.gov/22137566/
- Kayla M. Goforth et al., "Learned magnetic map cues and two mechanisms of
  magnetoreception in turtles," Nature, 2025:
  https://www.osti.gov/biblio/3004077
- "Disruption of the sea turtle magnetic map sense by a magnetic pulse,"
  Journal of Experimental Biology, 2025:
  https://journals.biologists.com/jeb/article/228/22/jeb251243/369804/Disruption-of-the-sea-turtle-magnetic-map-sense-by
