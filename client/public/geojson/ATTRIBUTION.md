# South Africa province boundaries

The `south-africa-provinces.geojson` file contains simplified GeoJSON polygons for
South Africa's nine provinces (ADM1).

- Dataset: geoBoundaries `ZAF-ADM1-76434192`, build dated 12 December 2023; boundaries represent 2020.
- Original boundary sources: OCHA Regional Office for Southern Africa (ROSEA) and the South African Municipal Demarcation Board.
- geoBoundaries release: commit `9469f09`, simplified GeoJSON asset.
- License: Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO).
- Metadata and download information: <https://www.geoboundaries.org/api/current/gbOpen/ZAF/ADM1/>.
- Source dataset metadata: <https://data.humdata.org/dataset/south-africa-admin-level-1-boundaries>.

The source feature for Northern Cape has a misspelled `shapeName`; the application uses
the boundary's province code to display the canonical name. The polygon geometry is
unchanged.

# South Africa municipality boundaries

The `south-africa-municipalities.geojson` file contains 213 municipality polygons for
municipality selection and map display.

- Dataset: Municipal Demarcation Board (MDB), Local Municipalities 2021.
- Source feature service: <https://services7.arcgis.com/oeoyTUJC8HEeYsRB/arcgis/rest/services/LocalMunicipalities2018_Final/FeatureServer/0>.
- Source item: <https://www.arcgis.com/home/item.html?id=27bbdd5b041b4ba6b5707dfed5aa3923>.
- Source metadata identifies MDB as producer and custodian; the feature service is named `LocalMunicipalities2018_Final`, while the item identifies the dataset as Local Municipalities 2021.
- Geometry is generalized by the source service at a 0.001-degree maximum allowable offset in WGS84 for web-map display. It is not suitable for cadastral, surveying, or legal boundary decisions.
- MDB terms allow public use and value-added products with attribution, prohibit commercial use and selling the data to third parties, and require acknowledging MDB as producer and custodian. Commercial use is not permitted under these terms; obtain separate permission or replace this dataset before any commercial use or sale.

Acknowledgment: Municipal Demarcation Board, 2018, Pretoria, Republic of South Africa.
