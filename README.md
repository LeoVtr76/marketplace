# Veille

This project need Alchemy to deploy contract in test blockchain and Pinata to store NFT's metadata.

## STEP-BY-STEP

### 1) Create git repo

Create Mint repo on github, and clone in local : `git clone ...`

### 2) Generate the nfts

In Mint folder, open the terminal and clone the github repository : `git clone https://github.com/HashLips/hashlips_art_engine.git `

Delete .git : `rm -rf hashlips_art_engine/.git`
rename hashlips_art_engine folder to MintNFT : `mv hashlips_art-engine MintNFT`

Custom layers in MintNFT/layers with personnal images.

Move to MintNFT : `cd MintNFT`
Edit src/config.js :

- Change namePrefix const to NFT collection name
- Add description in description const
- Choose the number of NFTs to generate in growEditionSizeTo const (here 8)
- edit layerConfigurations : remove all folder in layers folder and add Images folder and put it images
  in config.js edit it like this :

```ts
const layerConfigurations = [
  {
    growEditionSizeTo: 8,
    layersOrder: [{ name: "Images" }],
  },
];
```

- change image format if necessary in format const (1024 x 1024)
  install yarn : `npm install --global yarn` or `sudo npm install --global yarn` if permission denied, then `yarn install`
  install necessary lib for this project : `npm install`
  Update canvas : `npm update canvas`
  Generate NFT : `node index.js`

### 3) Pinata

On https://app.pinata.cloud/pinmanager, add images folder from : Mint/MintNFT/build/, name it "NFT_IMG"
Copy CID and paste it in Mint/MintNFT/src/config.js in baseUri const : "ipfs://CDI"

if necessary, move to MintNFT : `cd MintNFT`
Regenerate NFT json file : `node utils/update_info.js`

Add json folder in pinata, name it "NFT_JSON"

### 4) Create react app

move to Mint if necessary : `cd ..` (if in MintNFT)
Create react app client : `npx create-react-app client`
move to client : `cd client`

Create .env file in client : `touch .env`
Edit .env file like this :

```
WALLET_PRIVATE_KEY = "";
REACT_APP_CONTRACT_ADDRESS = "";
```

Copy your private key from Ganache and paste it in WALLET_PRIVATE_KEY.
Check if .env is in gitignore

### 6) Hardhat

Create hardhat project : `npx hardhat`, create typescript project, and click yes for the next.

In hardhat.config.ts, delete the code and paste this :

```javascript =
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

require("dotenv").config();

const config: HardhatUserConfig = {
  solidity: "0.8.19",
  paths: {
    artifacts: "./src/artifacts",
  },
  networks: {
    ganache: {
      url: "http://localhost:7545",
      chainId: 1337,
    },
  },
};

export default config;
```

Rename the smart contract in client/contracts by MintNFT.sol.
In MintNFT.sol, delete the code and paste this :

# A MODIFIER :

```js =
// SPDX-License-Identifier: GPL-3.0

// Created by HashLips
// The Nerdy Coder Clones

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MintNFT is ERC721Enumerable, Ownable {
  using Strings for uint256;

  string public baseURI;
  string public baseExtension = ".json";
  uint256 public cost = 0.01 ether;
  uint256 public maxSupply = 50;
  uint256 public maxMintAmount = 20;
  bool public paused = false;
  mapping(address => bool) public whitelisted;

  constructor(
    string memory _name,
    string memory _symbol,
    string memory _initBaseURI
  ) ERC721(_name, _symbol) {
    setBaseURI(_initBaseURI);
    mint(msg.sender, 5);
  }

  // internal
  function _baseURI() internal view virtual override returns (string memory) {
    return baseURI;
  }

  // public
  function mint(address _to, uint256 _mintAmount) public payable {
    uint256 supply = totalSupply();
    require(!paused);
    require(_mintAmount > 0);
    require(_mintAmount <= maxMintAmount);
    require(supply + _mintAmount <= maxSupply);

    if (msg.sender != owner()) {
        if(whitelisted[msg.sender] != true) {
          require(msg.value >= cost * _mintAmount);
        }
    }

    for (uint256 i = 1; i <= _mintAmount; i++) {
      _safeMint(_to, supply + i);
    }
  }

  function walletOfOwner(address _owner)
    public
    view
    returns (uint256[] memory)
  {
    uint256 ownerTokenCount = balanceOf(_owner);
    uint256[] memory tokenIds = new uint256[](ownerTokenCount);
    for (uint256 i; i < ownerTokenCount; i++) {
      tokenIds[i] = tokenOfOwnerByIndex(_owner, i);
    }
    return tokenIds;
  }

  function tokenURI(uint256 tokenId)
    public
    view
    virtual
    override
    returns (string memory)
  {
    require(
      _exists(tokenId),
      "ERC721Metadata: URI query for nonexistent token"
    );

    string memory currentBaseURI = _baseURI();
    return bytes(currentBaseURI).length > 0
        ? string(abi.encodePacked(currentBaseURI, tokenId.toString(), baseExtension))
        : "";
  }
  //only owner
  function setCost(uint256 _newCost) public onlyOwner {
    cost = _newCost;
  }

  function setmaxMintAmount(uint256 _newmaxMintAmount) public onlyOwner {
    maxMintAmount = _newmaxMintAmount;
  }

  function setBaseURI(string memory _newBaseURI) public onlyOwner {
    baseURI = _newBaseURI;
  }

  function setBaseExtension(string memory _newBaseExtension) public onlyOwner {
    baseExtension = _newBaseExtension;
  }

  function pause(bool _state) public onlyOwner {
    paused = _state;
  }

 function whitelistUser(address _user) public onlyOwner {
    whitelisted[_user] = true;
  }

  function removeWhitelistUser(address _user) public onlyOwner {
    whitelisted[_user] = false;
  }

  function withdraw() public payable onlyOwner {
    require(payable(msg.sender).send(address(this).balance));
  }
}
```

You can edit :

- the price of an NFT in cost variable
- the number of NFT in collection in maxSupply variable
- the number of NFTs minted to the owner upon deployment of the contract in the constructor : mint(msg.sender, `number`);

In client, install necessary lib : `npm install @openzeppelin/contracts`

In scripts/deploy.ts, delete code and paste this :

```js =
import { ethers } from "hardhat";

async function main() {
  const MintNFT = await ethers.deployContract(
    "MintNFT",
    ["Collection Name", "Symbol", "ipfs://CID/"],
    {}
  );
  await MintNFT.waitForDeployment();

  console.log(`MintNFT deployed to ${MintNFT.target}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

Change Collection Name, Symbol, copy the CID of NFT_JSON in Pinata and paste it instead of "CID" after ipfs://. Dont forget "/" after CID in url.

Deploy contract (always in client) : npx hardhat run scripts/deploy.ts --network maticTest

Copy the contract address in the console, and paste it in .env file.

To see NFT in metamask, click on import NFT, paste the contract adress and put 1 for the id, do this for the 5 NFT(id : 1, id : 2, ... id : 5)
You can this that in mumbai.polygonscan.com , in your account account ERC-721 Token Transaction.

### React app

From client, create img folder in src : `mkdir src/img`
Copy 10 first images in MintNFT/build/images, and paste it in client/src/img.

This guide being rather oriented towards hardhat, alchemy and pinata, there is no explanation for react.
So in src, open App.js, delete code and paste this :

```js =
import "./App.css";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import MintNFT from "./artifacts/contracts/MintNFT.sol/MintNFT.json";
import img1 from "./img/1.png";
import img2 from "./img/2.png";
import img3 from "./img/3.png";
import img4 from "./img/4.png";
import img5 from "./img/5.png";
import img6 from "./img/6.png";
import img7 from "./img/7.png";
import img8 from "./img/8.png";
import img9 from "./img/9.png";
import img10 from "./img/10.png";

const MintNFTAddress = process.env.REACT_APP_CONTRACT_ADDRESS;
function App() {
  const [state, setState] = useState({
    contract: null,
  });
  const [data, setData] = useState({});
  const [error, setError] = useState("");
  const [currentAccount, setCurrentAccount] = useState(null);
  const [ownerAccount, setOwnerAccount] = useState(null);

  useEffect(() => {
    const connectWallet = async () => {
      try {
        const { ethereum } = window;
        if (ethereum) {
          await ethereum.request({
            method: "eth_requestAccounts",
          });
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          setCurrentAccount(address);
          const contract = new ethers.Contract(
            MintNFTAddress,
            MintNFT.abi,
            signer
          );
          setState({ contract });
          fetchData(contract);
          fetchOwner(contract);
        }
      } catch (error) {
        console.log(error);
      }
    };
    const fetchOwner = async (contract) => {
      try {
        const owner = await contract.owner(); // ou await contract.getOwner();
        setOwnerAccount(owner);
      } catch (err) {
        console.error("Error fetching owner:", err);
      }
    };
    connectWallet();
  }, []);

  const fetchData = async (contract) => {
    try {
      const cost = await contract.cost();
      const totalSupply = await contract.totalSupply();
      const object = { cost: String(cost), totalSupply: String(totalSupply) };
      setData(object);
    } catch (err) {
      setError(err.message);
    }
  };
  const withdraw = async () => {
    if (state.contract) {
      try {
        const transaction = await state.contract.withdraw();
        transaction.wait();
        fetchData(state.contract);
      } catch (err) {
        setError(err.message);
      }
    }
  };
  const mint = async () => {
    if (state.contract) {
      try {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        let overrides = {
          value: data.cost,
        };
        const transaction = await state.contract.mint(
          accounts[0],
          1,
          overrides
        );
        await transaction.wait();
        fetchData(state.contract);
      } catch (err) {
        setError(err.message);
      }
    }
  };

  return (
    <div className="App">
      {ownerAccount === currentAccount && (
        <button className="withdraw" onClick={withdraw}>
          Withdraw
        </button>
      )}
      <div className="container">
        <div className="banniere">
          <img src={img1} alt="img" />
          <img src={img2} alt="img" />
          <img src={img3} alt="img" />
          <img src={img4} alt="img" />
          <img src={img5} alt="img" />
          <img src={img6} alt="img" />
          <img src={img7} alt="img" />
          <img src={img8} alt="img" />
          <img src={img9} alt="img" />
          <img src={img10} alt="img" />
        </div>
        {error && <p>{error}</p>}
        <h1>Mint a NFT !</h1>
        <p className="count">
          {data.totalSupply} NFT out of 50 have already been purchased
        </p>
        <p className="cost">
          Each NFT costs {data.cost / 10 ** 18} ETH (excluding gas fees)
        </p>
        <button onClick={mint}>Buy one NFT</button>
      </div>
    </div>
  );
}

export default App;
```

Same thing for App.css :

```css =
@import url("https://fonts.googleapis.com/css2?family=Pacifico&family=Roboto:wght@100;300;400;700&display=swap");

.App {
  text-align: center;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
}

html {
  font-size: 16px;
}

body {
  font-family: "Roboto", sans-serif;
}

.container {
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding-left: 1rem;
  padding-right: 1rem;
}

.banniere {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
}

.banniere img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

h1 {
  font-family: "Pacifico", cursive;
}

.count {
  font-size: 2rem;
  font-weight: 700;
}

.cost {
  font-weight: 300;
}

button {
  background: rgb(255, 217, 0);
  padding: 1rem 2rem;
  border-radius: 20px;
  font-weight: 700;
  border: 0;
  cursor: pointer;
}
```

Start local website : `npm start`
