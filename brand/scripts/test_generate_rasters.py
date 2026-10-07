"""Tests for generate-rasters.py.

    python3 -m unittest discover -s brand/scripts

Generates into a temporary directory, never into brand/favicon/, and checks
the contract each platform relies on: file names (referenced from
site.webmanifest and the example's index.html), pixel dimensions, colour mode
(transparent where the platform composites for us, opaque where it would pick
its own background or crop to a mask) and the frame sizes inside the .ico.
"""

import contextlib
import importlib.util
import io
import os
import tempfile
import unittest

try:
    from PIL import Image
except ImportError:  # pragma: no cover - environment without Pillow
    Image = None

HERE = os.path.dirname(os.path.abspath(__file__))

# name -> (width, height, mode)
EXPECTED = {
    "favicon-16x16.png": (16, 16, "RGBA"),
    "favicon-32x32.png": (32, 32, "RGBA"),
    "apple-touch-icon.png": (180, 180, "RGB"),
    "android-chrome-192x192.png": (192, 192, "RGBA"),
    "android-chrome-512x512.png": (512, 512, "RGBA"),
    "maskable-icon-512x512.png": (512, 512, "RGB"),
    "favicon.ico": (64, 64, None),  # largest frame; frames checked separately
    "og-image.png": (1200, 630, "RGB"),
}
ICO_FRAMES = {(16, 16), (32, 32), (48, 48), (64, 64)}


def load_generator():
    # The script's name has a hyphen, so it cannot be imported by name.
    path = os.path.join(HERE, "generate-rasters.py")
    spec = importlib.util.spec_from_file_location("generate_rasters", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@unittest.skipIf(Image is None, "Pillow is required: pip install Pillow")
class GenerateRastersTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.generator = load_generator()
        cls._tmp = tempfile.TemporaryDirectory()
        cls.out = cls._tmp.name
        with contextlib.redirect_stdout(io.StringIO()):
            cls.written = cls.generator.main(cls.out)

    @classmethod
    def tearDownClass(cls):
        cls._tmp.cleanup()

    def test_writes_exactly_the_expected_files(self):
        self.assertCountEqual(self.written, EXPECTED)
        self.assertCountEqual(os.listdir(self.out), EXPECTED)

    def test_does_not_touch_the_committed_assets_directory(self):
        self.assertNotEqual(
            os.path.realpath(self.out), os.path.realpath(self.generator.FAV)
        )

    def test_dimensions_and_modes(self):
        for name, (width, height, mode) in EXPECTED.items():
            with self.subTest(name=name), Image.open(os.path.join(self.out, name)) as img:
                self.assertEqual(img.size, (width, height))
                if mode is not None:
                    self.assertEqual(img.mode, mode)

    def test_transparent_icons_have_transparent_corners(self):
        # Padding exists on every transparent render, so (0, 0) is background.
        for name, (_, _, mode) in EXPECTED.items():
            if mode != "RGBA":
                continue
            with self.subTest(name=name), Image.open(os.path.join(self.out, name)) as img:
                self.assertEqual(img.getpixel((0, 0))[3], 0)

    def test_ico_contains_every_frame_size(self):
        with Image.open(os.path.join(self.out, "favicon.ico")) as ico:
            self.assertEqual(ico.format, "ICO")
            self.assertEqual(set(ico.info["sizes"]), ICO_FRAMES)

    def test_mark_is_drawn(self):
        # Guards against a geometry or compositing regression that produces a
        # blank or single-colour image: the three brand hues must all appear.
        with Image.open(os.path.join(self.out, "android-chrome-512x512.png")) as img:
            colours = {rgba[:3] for _, rgba in img.getcolors(img.width * img.height) if rgba[3] == 255}
        self.assertGreater(len(colours), 3)


if __name__ == "__main__":
    unittest.main()
