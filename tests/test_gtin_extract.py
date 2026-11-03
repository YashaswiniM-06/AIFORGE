import sys
import unittest
from types import SimpleNamespace
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lib'))
from extract import gtin_from_payload, scan_codes


class GtinPayloadTests(unittest.TestCase):
    def test_extracts_only_gtin_from_supported_linear_formats(self):
        self.assertEqual(gtin_from_payload('4006381333931', 'EAN_13'), '4006381333931')
        self.assertEqual(gtin_from_payload('1 20000 00004 3', 'UPCA'), '120000000043')

    def test_retains_bad_check_digit_candidate_for_deterministic_review(self):
        self.assertEqual(gtin_from_payload('4006381333932', 'EAN13'), '4006381333932')

    def test_extracts_explicit_gs1_ai_01_from_qr_payload_without_retaining_other_data(self):
        self.assertEqual(gtin_from_payload('https://example.test/01/04006381333931/10/LOT-A', 'QRCode'), '04006381333931')
        self.assertEqual(gtin_from_payload(']C10104006381333931', 'Code128'), '04006381333931')

    def test_expands_upc_e_to_canonical_upc_a_value(self):
        self.assertEqual(gtin_from_payload('04252614', 'UPCE'), '042100005264')
        self.assertEqual(gtin_from_payload('0036000291452', 'UPCE'), '0036000291452')

    def test_does_not_store_unrelated_qr_or_text_payload(self):
        self.assertIsNone(gtin_from_payload('https://example.test/product/12345678', 'QRCode'))
        self.assertIsNone(gtin_from_payload('12345678', 'QRCode'))

    def test_scanner_keeps_only_gtin_metadata_even_when_checksum_is_bad(self):
        point=lambda x,y:SimpleNamespace(x=x,y=y)
        position=SimpleNamespace(top_left=point(10,5),top_right=point(50,5),bottom_left=point(10,25),bottom_right=point(50,25))
        result=SimpleNamespace(format=SimpleNamespace(name='EAN13'),text='4006381333932',valid=False,position=position)
        fake_scanner=SimpleNamespace(read_barcodes=lambda image,**kwargs:[result] if kwargs=={'return_errors':True} else [])
        with patch.dict(sys.modules,{'zxingcpp':fake_scanner}):
            codes,warning=scan_codes(SimpleNamespace(size=(100,50)))
        self.assertIsNone(warning)
        self.assertEqual(codes[0]['gtin'],'4006381333932')
        self.assertEqual(set(codes[0]),{'format','box','gtin'})

    def test_scanner_discards_non_gtin_qr_payload(self):
        point=lambda x,y:SimpleNamespace(x=x,y=y)
        position=SimpleNamespace(top_left=point(10,5),top_right=point(50,5),bottom_left=point(10,25),bottom_right=point(50,25))
        result=SimpleNamespace(format=SimpleNamespace(name='QRCode'),text='https://example.test/product/12345678',valid=True,position=position)
        fake_scanner=SimpleNamespace(read_barcodes=lambda image,**kwargs:[result] if kwargs=={'return_errors':True} else [])
        with patch.dict(sys.modules,{'zxingcpp':fake_scanner}):
            codes,warning=scan_codes(SimpleNamespace(size=(100,50)))
        self.assertIsNone(warning)
        self.assertEqual(set(codes[0]),{'format','box'})


if __name__ == '__main__':
    unittest.main()
